import { Plugin } from 'prosemirror-state';
import Promise from 'bluebird';
import { Slice } from 'prosemirror-model';
import firebase from 'firebase';
import { insertPoint } from 'prosemirror-transform';
import { keys } from './pluginKeys';
import { schema } from '../schema';

const { Selection } = require('prosemirror-state')
const { Node } = require('prosemirror-model')
const { Step } = require('prosemirror-transform')
const { collab, sendableSteps, receiveTransaction } = require('prosemirror-collab')
const { compressStepsLossy, compressStateJSON, uncompressStateJSON, compressSelectionJSON, uncompressSelectionJSON, compressStepJSON, uncompressStepJSON } = require('prosemirror-compress')
const TIMESTAMP = { '.sv': 'timestamp' }


const { DecorationSet, Decoration } = require('prosemirror-view');


const firebaseConfig = {
  apiKey: "AIzaSyBpE1sz_-JqtcIm2P4bw4aoMEzwGITfk0U",
  authDomain: "pubpub-rich.firebaseapp.com",
  databaseURL: "https://pubpub-rich.firebaseio.com",
  projectId: "pubpub-rich",
  storageBucket: "pubpub-rich.appspot.com",
  messagingSenderId: "543714905893"
};
const firebaseApp = firebase.initializeApp(firebaseConfig);
const db = firebase.database(firebaseApp);

function stringToColor(string, alpha = 1) {
    let hue = string.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % 360
    return `hsla(${hue}, 100%, 50%, ${alpha})`
}

// Checkpoint a document every 100 steps
const SAVE_EVERY_N_STEPS = 100;


// how to implement forking:
// - create a new editor that forks & duplicates?


// healDatabase - In case a step corrupts the document (happens surpsiginly often), apply each step individually to find errors
// and then delete all of those steps
const healDatabase = ({ changesRef, steps, editor, placeholderClientId }) => {
  const stepsToDelete = [];
  for (const step of steps) {
    try {
      editor.dispatch(receiveTransaction(editor.state, step.steps, [placeholderClientId]));
    } catch (err) {
      stepsToDelete.push(step.key);
    }
  }

  for (const stepsToDelete of stepsToDelete) {
    changesRef.child(stepsToDelete).remove();
  }
};

const FirebasePlugin = ({ selfClientID, editorKey }) => {

  const collabEditing = require('prosemirror-collab').collab;
  const firebaseDb = firebase.database();
  const firebaseRef = firebaseDb.ref(editorKey);

  const checkpointRef  = firebaseRef.child('checkpoint');
  const changesRef = firebaseRef.child('changes');
  const selectionsRef = firebaseRef.child('selections');
  const selfSelectionRef = selectionsRef.child(selfClientID);
  selfSelectionRef.onDisconnect().remove();
  const selections = {};
  const selfChanges = {};
  let selection = undefined;
  let fetchedState = false;
  let latestKey;
  let selectionMarkers = {};
  let editorView;

  let loadingPromise = Promise.defer();

  const loadDocumentAndListen = (view) => {


    if (fetchedState) {
      return;
    }

    checkpointRef.once('value').then(
      function (snapshot) {
        // progress(1 / 2)
        let { d, k } = snapshot.val() || {}
        latestKey = k ? k : -1;
        latestKey = Number(latestKey)
        const newDoc = d && Node.fromJSON(view.state.schema, uncompressStateJSON({ d }).doc)

        function compressedStepJSONToStep(compressedStepJSON) {
          return Step.fromJSON(view.state.schema, uncompressStepJSON(compressedStepJSON)) }

        fetchedState = true;


        if (newDoc) {
          const { EditorState } = require('prosemirror-state');
      		const newState = EditorState.create({
      			doc: newDoc,
      			plugins: view.state.plugins,
      		});
      		view.updateState(newState);
        }


        return changesRef.startAt(null, String(latestKey + 1)).once('value').then(
          function (snapshot) {
            // progress(2 / 2)
            // const view = this_.view = constructView({ newDoc, updateCollab, selections })
            const editor = view

            const changes = snapshot.val()
            if (changes) {
              const steps = []
              const stepClientIDs = []
              const placeholderClientId = '_oldClient' + Math.random()
              const keys = Object.keys(changes)
              const stepsWithKeys = [];
              latestKey = Math.max(...keys)
              for (let key of keys) {
                const compressedStepsJSON = changes[key].s;
                const stepWithKey = {key, steps: compressedStepsJSON.map(compressedStepJSONToStep)};
                steps.push(...compressedStepsJSON.map(compressedStepJSONToStep));
                stepsWithKeys.push(stepWithKey);
                stepClientIDs.push(...new Array(compressedStepsJSON.length).fill(placeholderClientId))
              }
              try {
                editor.dispatch(receiveTransaction(editor.state, steps, stepClientIDs))
              } catch (err) {
                healDatabase({changesRef, editor, steps: stepsWithKeys, placeholderClientId});
              }

            }

            loadingPromise.resolve();

            function updateClientSelection(snapshot) {
              const clientID = snapshot.key
              if (clientID !== selfClientID) {
                const compressedSelection = snapshot.val()
                if (compressedSelection) {
                  try {
                    selections[clientID] = Selection.fromJSON(editor.state.doc, uncompressSelectionJSON(compressedSelection))
                  } catch (error) {
                    console.warn('updateClientSelection', error)
                  }
                } else {
                  delete selections[clientID]
                }
                editor.dispatch(editor.state.tr)
              }
            }
            selectionsRef.on('child_added', updateClientSelection)
            selectionsRef.on('child_changed', updateClientSelection)
            selectionsRef.on('child_removed', updateClientSelection)

            changesRef.startAt(null, String(latestKey + 1)).on(
              'child_added',
              function (snapshot) {
                latestKey = Number(snapshot.key)
                const { s: compressedStepsJSON, c: clientID, m: meta } = snapshot.val()
                const steps = (
                  clientID === selfClientID ?
                    selfChanges[latestKey]
                  :
                    compressedStepsJSON.map(compressedStepJSONToStep) )
                const stepClientIDs = new Array(steps.length).fill(clientID)
                const trans = receiveTransaction(editor.state, steps, stepClientIDs);
                if (meta) {
                  for (let metaKey in meta) {
                    trans.setMeta(metaKey, meta[metaKey]);
                  }
                }
                editor.dispatch(trans);
                delete selfChanges[latestKey]
              } )

            /*
            return Object.assign({
              destroy: this_.destroy.bind(this_),
            }, this_);
            */

          } )
      } );

  }



  return new Plugin({
  	state: {
  		init(config, instance) {

  			return { };
  		},
  		apply(transaction, state, prevEditorState, editorState) {
  			return { };
  		}
  	},

    view: function(_editorView) {
  		editorView = editorView;
  		loadDocumentAndListen(_editorView);
  		return {
  			update: (newView, prevState) => {
  				this.editorView = newView;
  			},
  			destroy: () => {
  				this.editorView = null;
  			}
  		}
  	},

  	props: {

      fork(forkID) {
        const editorRef = firebaseDb.child(editorKey);
        return new Promise((resolve, reject) => {
          editorRef.once('value', function(snapshot) {
            firebaseDb.ref(forkID).set(snapshot.val(), function(error) {
              if (!error) {
                const { d } = compressStateJSON(editorView.state.toJSON());
                const forkCheckPoint = { d, k: latestKey, t: TIMESTAMP };
                editorRef.key('forks').key(forkID).set(forkCheckPoint);
                resolve(forkID);
              } else {
                reject(error);
              }
            });
          });
        });

      },

      getForks() {
        return loadingPromise.promise.then(() => {
          console.log('loading promise loaded!');
          const forksKey = firebaseDb.ref(editorKey).child("forks");
          return new Promise((resolve, reject) => {
            forksKey.once('value', function(snapshot) {
              resolve(snapshot.val());
            });
          });
        })
      },

      updateCollab({ docChanged, mapping, meta }, newState) {
        if (docChanged) {
          for (let clientID in selections) {
            selections[clientID] = selections[clientID].map(newState.doc, mapping)
          }
        }

        // return after meta pointer?
        if (meta.pointer) {
          delete(meta.pointer);
        }
        if (meta["collab$"]) {
          return;
        }
        if (meta.rebase) {
          delete(meta.rebase)
        }
        if (meta.addToHistory) {
          delete(meta.addToHistory)
        }
        const sendable = sendableSteps(newState)
        if (sendable) {
          const { steps, clientID } = sendable
          changesRef.child(latestKey + 1).transaction(
            function (existingBatchedSteps) {
              if (!existingBatchedSteps) {
                selfChanges[latestKey + 1] = steps
                return {
                  s: compressStepsLossy(steps).map(
                    function (step) {
                      return compressStepJSON(step.toJSON()) } ),
                  c: clientID,
                  m: meta,
                  t: TIMESTAMP,
                }
              }
            },
            function (error, committed, { key }) {
              if (error) {
                console.error('updateCollab', error, sendable, key)
              } else if (committed && key % SAVE_EVERY_N_STEPS === 0 && key > 0) {
                const { d } = compressStateJSON(newState.toJSON())
                checkpointRef.set({ d, k: key, t: TIMESTAMP })
              }
            },
            false )
        }

        const selectionChanged = !newState.selection.eq(selection)
        if (selectionChanged) {
          selection = newState.selection
          selfSelectionRef.set(compressSelectionJSON(selection.toJSON()))
        }
      },


  		decorations(state) {
        return DecorationSet.create(state.doc, Object.entries(selections).map(
          function ([ clientID, { from, to } ]) {
             console.log(clientID, selfClientID);
              if (clientID === selfClientID) {
                return null;
              }
              if (from === to) {
                  let elem = document.createElement('span')
                  elem.className = "collab-cursor";
                  elem.style.borderLeft = `1px solid ${stringToColor(clientID)}`
                  return Decoration.widget(from, elem)
              } else {
                  return Decoration.inline(from, to, {
                      style: `background-color: ${stringToColor(clientID, 0.2)};`,
                  })
              }
          }
        ));
  		},
  	},
    key: keys.firebase,
  });

}



export default FirebasePlugin;
