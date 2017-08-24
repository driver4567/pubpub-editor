import { } from './commits';

import { AddMarkStep, ReplaceAroundStep, ReplaceStep, canJoin, insertPoint, joinPoint, replaceStep } from 'prosemirror-transform';
import { Decoration, DecorationSet } from "prosemirror-view";
import { Fragment, Node, NodeRange, Slice } from 'prosemirror-model';
import { getPlugin, keys } from './pluginKeys';

import { Plugin } from 'prosemirror-state';
import { schema } from '../schema';

const { Selection } = require('prosemirror-state');
const { Step, findWrapping, Mapping } = require('prosemirror-transform');



/*
- How to store in a firebase account?
- How to not store marks in steps?
*/

/*
  if you only store deletions in a map, then inevitably it will be removeD?
  instead store deletions to remove after a certain map?
  e.g. store at POS 34, remove 4. at pos 40, remove 5
  How to represent deleted items? Can't use widgets because of removal
*/

/*
NEED TO STORE OFFSETS IN FIREBASE!!!

*/


/*
Sketch of one channel merge:
  - Gather all steps
  -

*/


// need to store an array of steps that recreate the original document
// need to store mappings that remove additions

// keep a track of commits
// check if the new commit is not near the others
// otherwise, keep grouping until it happens


// keep a mapping of all steps/domains?
function isAdjacentToLastStep(step, prevMap) {
  if (!prevMap) return false
  let firstMap = step.getMap(), adjacent = false
  if (!firstMap) return true
  firstMap.forEach((start, end) => {
    prevMap.forEach((_start, _end, rStart, rEnd) => {
      if (start <= rEnd && end >= rStart) adjacent = true
    })
    return false
  })
  return adjacent
}


// commitUUID
// UUIDs enable easy tracking of commits
/*
Keeps track of local stages & commits?

Keep track of collaborated commits to merge steps between?
Needs to keep a true doc of all steps? To make sure that this doc is consistent and allow for inversions and stuff?
*/


// make a class with functions?
const trackChangesPlugin = new Plugin({
  state: {
    init(config, instance) {
      this.storedSteps = [];
      this.sendableSteps = [];
      this.stepOffsets = [];
      this.sendableOffsets = [];

      this.transactions = {};

      this.tracker = new AdjacentTracker(this);

      this.storeStep = (step) => {
        this.tracker.add(step);
        if (step.slice && step.slice.content) {
          for (const stepContent of step.slice.content.content) {
            const marks = stepContent.marks;
            const diffPlusMark = schema.marks['diff_plus'];
            const diffMinusMark = schema.marks['diff_minus'];
            stepContent.marks = diffMinusMark.removeFromSet(diffPlusMark.removeFromSet(marks));
          }
        }
        this.storedSteps.push(step);
        this.sendableSteps.push(step);
      };


      this.storeOffset = (stepOffset) => {
        this.stepOffsets.push(stepOffset);
        this.sendableOffsets.push(stepOffset);
      };

      this.getSendableSteps = () => {
        const steps = this.sendableSteps;
        const offsets = this.sendableOffsets;

        this.sendableSteps = [];
        this.sendableOffsets = [];

        if (steps.length > 0 || offsets.length > 0) {
          return { steps, offsets };
        }
        return null;
      };

      return {
        deco: DecorationSet.empty, commit: null
      };
    },
    apply(transaction, state, prevEditorState, editorState) {

      return state;
    }
  },




  appendTransaction: function (transactions, oldState, newState) {
    const firstTransaction = transactions[0];
    if (!firstTransaction || transactions.length > 1) {
      return;
    }
    let transaction = firstTransaction;

    if (transaction.getMeta("trackAddition") || transaction.getMeta("backdelete") || transaction.getMeta('history$') || transaction.getMeta('collab$')) {
      return;
    }

    if (transaction.mapping && transaction.mapping.maps.length > 0) {
      const sel = newState.selection;
      const pos = sel.$from;


      /*
        For each step in the transaction, adjust the positions of the steps
        according to the step offsets stored. Step offsets store additions to the document
        mainly deletions
      */
      for (const step of transaction.steps) {
        let mappedStep = step;
        let totalOffset = 0;

        for (const stepOffset of this.stepOffsets) {
          if (mappedStep.from > stepOffset.index) {
            totalOffset = totalOffset + stepOffset.size;
          }
        }

        mappedStep = mappedStep.offset(totalOffset * -1);
        this.storeStep(mappedStep);
      }

      if (!pos.parent || !pos.parent.nodeType || pos.parent.nodeType.name !== 'diff') {

        let tr = newState.tr;

        const mappings = transaction.mapping.maps;

        for (const step of transaction.steps) {
          const map = step.getMap();

          if (step instanceof AddMarkStep || step instanceof ReplaceAroundStep) {
            tr = tr.addMark(step.from, step.to, schema.mark('diff_plus', { commitID: this.commitID }));
            tr.setMeta("trackAddition", true);
            continue;
          }

          if (!step.slice) {
            continue;
          }

          const slice = step.slice.content;


          map.forEach((oldStart, oldEnd, newStart, newEnd) => {

            if (oldStart !== oldEnd) {
              const inverse = step.invert(oldState.doc);


              /*
              This checks if it is a 'space operation' that prosemirror does, i.e. it will sometimes replace a space with a space and the character you just typed.
              */
              let isSpaceOperation = false;

              const replacedFragment = step.slice.content;
              const oldFragment = inverse.slice.content;
              const fragmentIsText = function(fragment) {
                return (fragment.content && fragment.content.length === 1 && fragment.content[0].isText === true);
              }

              if (fragmentIsText(replacedFragment) && fragmentIsText(oldFragment)) {
                const replacedNodeText = replacedFragment.content[0].text;
                const oldNodeText = oldFragment.content[0].text;
                if (oldNodeText.charAt(0).trim() == '' && replacedNodeText.length === 2 && replacedNodeText.charAt(0).trim() == '') {
                  isSpaceOperation = true;
                }
              }


              if (isSpaceOperation) {
                tr = tr.addMark(newStart, newEnd, schema.mark('diff_plus', { commitID: this.commitID }));
                return;
              }


              tr = tr.step(inverse);
              const slice = step.slice.content;
              const possibleInsert = tr.mapping.map(newEnd, 1);

              if (step.slice.size > 0) {
                const insertstep = replaceStep(oldState.doc, possibleInsert, possibleInsert, (step.slice.size > 0) ? step.slice : Slice.empty);
                const newOffset = { index: oldEnd, size: inverse.slice.size };
                this.stepOffsets.push(newOffset);
                try {
                  tr = tr.step(insertstep);
                } catch (err) {
                  console.log('cannot do this!', insertstep, step);
                  console.log(err);
                }
                tr = tr.addMark(oldStart, oldEnd, schema.mark('diff_minus', { commitID: this.commitID }));
                const insertStart = tr.mapping.map(newEnd, -1);
                const insertEnd = tr.mapping.map(newEnd, 1);
                tr = tr.addMark(insertStart, insertEnd, schema.mark('diff_plus', { commitID: this.commitID }));
              } else {
                const insertStart = tr.mapping.map(newEnd, -1);
                const insertEnd = tr.mapping.map(newEnd, 1);
                tr = tr.addMark(oldStart, oldEnd, schema.mark('diff_minus', { commitID: this.commitID }));
                const newOffset = { index: oldEnd, size: inverse.slice.size };
                this.stepOffsets.push(newOffset);
                // tr = tr.addMark(insertStart, insertEnd, schema.mark('diff_plus', { commitID: this.commitID }));
              }
              /*
              let i;
              let lastRange = null;
              for (i = oldStart; i <= oldEnd; i++) {
                const incrementPos = tr.doc.resolve(oldStart);
                const incrementPos = tr.doc.resolve(oldStart);
              }
              */
              // tr = tr.addMark(oldStart, oldEnd, schema.mark('diff_minus', {}));

              tr.setMeta("backdelete", true);
              tr.setMeta("trackAddition", true);
            //  transaction.setMeta('appendedTransaction', true);

            } else {
              tr = tr.addMark(newStart, newEnd, schema.mark('diff_plus', { commitID: this.commitID }));
              tr.setMeta("trackAddition", true);
            //  transaction.setMeta('appendedTransaction', true);

            }


          });
        }

        return tr;
      }
      return null;
    }
    return null;
  },
  view: function(editorView) {
    this.editorView = editorView;
    return {
      update: (newView, prevState) => {
        this.editorView = newView;
      },
      destroy: () => {
        this.editorView = null;
      }
    }
  },
  key: keys.track,
  props: {
    updateCommits: function(commits) {
      this.commits = commits;
    },
    updateCommitID: function(commitID) {
      this.commitID = commitID;
    },
    getTrackedSteps: function() {
      return this.storedSteps;
    },
    handleKeyDown: function (view, event) {
      if (event.code === 'Backspace') {
        const sel = view.state.selection;
        const pos = sel.$from;
        let tr = view.state.tr;
        // what if they delete a region??
        const beforeSel = Selection.findFrom(view.state.doc.resolve(sel.from - 1), -1, true);
        const marks = beforeSel.$from.marks();
        const hasDiff = marks.find((mark) => {
          return (mark.type.name === 'diff_plus');
        });
        const deleteStep = replaceStep(tr.doc, beforeSel.from, sel.from, Slice.empty);
        if (hasDiff) {
          // need to actually delete it but then avoid random deletions
          tr.step(deleteStep);
          tr.setMeta('backdelete', true);
          view.dispatch(tr);
          return true;
        }
        // is this step size always 1??
        const newOffset = { index: beforeSel.from, size: 1 };
        this.storeStep(deleteStep);
        this.stepOffsets.push(newOffset);

        tr = tr.addMark(beforeSel.from, sel.from, schema.mark('diff_minus', { commitID: this.commitID }));
        tr = tr.setSelection(beforeSel);
        tr.setMeta('backdelete', true);
        tr.setMeta('trackAddition', true);
        //tr.setMeta('appendedTransaction', true);

        view.dispatch(tr);

        return true;
      }
    },

  }
});

export default trackChangesPlugin;
