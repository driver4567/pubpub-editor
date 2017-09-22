import React, { Component } from 'react';

import { EditorState } from 'prosemirror-state';
import { EditorView } from 'prosemirror-view';
import PropTypes from 'prop-types';
import ReactView from './schema/reactView';
// import { configureClipboard } from './schema/setup/clipboard';
// import configureNodeViews from '../schema/editable/configure';
// import { createRichMention } from '../addons/Autocomplete/autocompleteConfig';
import createSchema from './schema';
import { getBasePlugins } from './schema/setup';

const propTypes = {
	initialContent: PropTypes.object,
	onChange: PropTypes.func,
	children: PropTypes.node,
	placeholder: PropTypes.string,
	isReadOnly: PropTypes.bool,
};

const defaultProps = {
	initialContent: undefined,
	onChange: undefined,
	children: undefined,
	placeholder: undefined,
	isReadOnly: false,
};

class Editor extends Component {
	constructor(props) {
		super(props);
		this.containerId = `pubpub-editor-container-${Math.round(Math.random() * 10000)}`;
		this.state = {};
		// this.onChange = this.onChange.bind(this);
		this.getJSON = this.getJSON.bind(this);
		this.configureSchema = this.configureSchema.bind(this);
		this.configurePlugins = this.configurePlugins.bind(this);
		this.createEditor = this.createEditor.bind(this);
		// this.updateMentions = this.updateMentions.bind(this);
		// this.onMentionSelection = this.onMentionSelection.bind(this);
		this.remove = this.remove.bind(this);
		// this.getMentionPos = this.getMentionPos.bind(this);
		// this.getTrackedSteps = this.getTrackedSteps.bind(this);
		// this.rebaseSteps = this.rebaseSteps.bind(this);
		// this.rebase = this.rebase.bind(this);
		// this.rebaseByCommit = this.rebaseByCommit.bind(this);
		// this.commit = this.commit.bind(this);
		this._onAction = this._onAction.bind(this);
	}

	componentDidMount() {
		this.createEditor();
	}

	// onChange() {
	// 	this.props.onChange(this.view.state.doc.toJSON());
	// }

	getJSON() {
		return this.view.state.doc.toJSON();
	}

	focus() {
		this.view.focus();
	}

	configurePlugins(schema) {
		// const schema = createSchema();

		let plugins = getBasePlugins({ schema, placeholder: this.props.placeholder });
		if (this.props.children) {
			React.Children.forEach(this.props.children, (child)=> {
				if (child.type.getPlugins) {
					plugins = plugins.concat(child.type.getPlugins(child.props));
				}
			});
		}

		return plugins;
	}

	configureNodeViews(schema) {
		const nodeViews = {};
		const nodes = schema.nodes;
		Object.keys(nodes).forEach((nodeName) => {
			const nodeSpec = nodes[nodeName].spec;
			if (nodeSpec.toEditable) {
				nodeViews[nodeName] = (node, view, getPos, decorations) => {
					return new ReactView(node, view, getPos, decorations, this.props.isReadOnly);
				};
			}
		});

		return nodeViews;
	}

	configureSchema() {
		const schemaNodes = {};
		const schemaMarks = {};
		if (this.props.children) {
			React.Children.forEach(this.props.children, (child)=> {
				if (child.type.schema) {
					const { nodes, marks } = child.type.schema(child.props);
					Object.keys(nodes || {}).forEach((key) => {
						schemaNodes[key] = nodes[key];
					});
					Object.keys(marks || {}).forEach((key) => {
						schemaMarks[key] = marks[key];
					});
				}
			});
		}

		const schema = createSchema(schemaNodes, schemaMarks);
		return schema;
	}

	createEditor() {
		if (this.view) {
			this.remove();
		}

		const schema = this.configureSchema();
		const place = this.editorElement;

		const contents = this.props.initialContent;
		const plugins = this.configurePlugins(schema);
		const nodeViews = this.configureNodeViews(schema);

		const stateConfig = {
			doc: (contents) ? schema.nodeFromJSON(contents) : schema.nodes.doc.create(),
			schema: schema,
			plugins: plugins,
		};

		// const {
		// 	clipboardParser,
		// 	clipboardSerializer,
		// 	transformPastedHTML
		// } = configureClipboard({ schema });

		const state = EditorState.create(stateConfig);
		const editorView = document.createElement('div');
		// editorView.className = 'pub-body';
		place.appendChild(editorView);

		// const props = {
		// 	referencesList: this.props.localFiles,
		// 	createFile: this.props.handleFileUpload,
		// 	createReference: this.props.handleReferenceAdd,
		// 	captureError: this.props.onError,
		// 	onChange: this.onChange,
		// 	updateCommits: this.props.updateCommits,
		// 	updateMentions: this.updateMentions,
		// };


		this.view = new EditorView(editorView, {
			state: state,
			dispatchTransaction: this._onAction,
			spellcheck: true,
			// clipboardSerializer: clipboardSerializer,
			// transformPastedHTML: transformPastedHTML,
			// handleDOMEvents: {
			// 	dragstart: (view, evt) => {
			// 		evt.preventDefault();
			// 		return true;
			// 	},
			// },
			// viewHandlers: {
			// 	updafteMentions: this.updateMentions,
			// },
			editable: () => (!this.props.isReadOnly),
			nodeViews: nodeViews,
		});

		this.setState({ view: this.view, editorState: state });
	}

	// updateMentions(mentionInput) {
	// 	if (mentionInput) {
	// 		setTimeout(()=> {
	// 			const container = document.getElementById('rich-editor-container');
	// 			const mark = document.getElementsByClassName('mention-marker')[0];
	// 			if (!container || !mark) {
	// 				return this.setState({ visible: false });
	// 			}
	// 			const top = mark.getBoundingClientRect().bottom - container.getBoundingClientRect().top;
	// 			const left = mark.getBoundingClientRect().left - container.getBoundingClientRect().left;
	// 			return this.setState({
	// 				visible: true,
	// 				top: top,
	// 				left: left,
	// 				input: mentionInput,
	// 			});
	// 		}, 0);
	// 	} else {
	// 		this.setState({ visible: false });
	// 	}
	// }

	// onMentionSelection(selectedObject) {
	// 	const mentionPos = this.editor.getMentionPos();
	// 	createRichMention(this.editor, selectedObject, mentionPos.start, mentionPos.end);
	// }

	remove() {
		if (this.view) {
			this.view.destroy();
		}
	}

	// rebaseSteps(steps) {
	// 	let rebasePlugin;
	// 	if (rebasePlugin = getPlugin('rebase', this.view.state)) {
	// 		return rebasePlugin.props.rebaseSteps.bind(rebasePlugin)(this.view, steps);
	// 	}
	// 	return Promise.resolve(null);
	// }

	// rebase(forkID) {
	// 	let firebasePlugin;
	// 	if (firebasePlugin = getPlugin('firebase', this.view.state)) {
	// 		return firebasePlugin.props.rebase.bind(firebasePlugin)(forkID);
	// 	}
	// 	return Promise.resolve(null);
	// }

	// rebaseByCommit(forkID) {
	// 	let firebasePlugin;
	// 	if (firebasePlugin = getPlugin('firebase', this.view.state)) {
	// 		return firebasePlugin.props.rebaseByCommit.bind(firebasePlugin)(forkID);
	// 	}
	// 	return Promise.resolve(null);
	// }

	// commit(msg) {
	// 	let firebasePlugin;
	// 	/* ??? Should this be comparative? */
	// 	/* Doesn't seem like it - but why have the let? Why not just set? */
	// 	if (firebasePlugin = getPlugin('firebase', this.view.state)) {
	// 		return firebasePlugin.props.commit.bind(firebasePlugin)(msg);
	// 	}
	// 	return Promise.resolve(null);
	// }


	_onAction(transaction) {
		if (this.view && this.view.state) {
			const newState = this.view.state.apply(transaction);
			this.view.updateState(newState);
			this.setState({ editorState: newState, transaction: transaction });
			if (this.props.onChange) {
				this.props.onChange(this.view.state.doc.toJSON());
			}
		}
	}

	render() {
		return (
			<div style={{ position: 'relative' }} id={this.containerId}>
				<style>{`
					.prosemirror-placeholder {
						opacity: 0.5;
						width: 0;
						display: inline-block;
						overflow: visible;
						white-space: nowrap;
					}
					.ProseMirror:focus {
						outline: 0px;
					}

					/*Wierd bug with blueprint editable text empty on default*/
					.pt-editable-text:not(.pt-editable-editing) .pt-editable-content {
					  height: auto !important;
					}

				`}</style>
				{this.state.view
					? React.Children.map(this.props.children, (child) => {
						return React.cloneElement(child, {
							view: this.state.view,
							editorState: this.state.editorState,
							transaction: this.state.transaction,
							containerId: this.containerId
						});
					})
					: null
				}

				<div ref={(elem)=> { this.editorElement = elem; }} className="pubpub-editor" />
			</div>
		);
	}
}

Editor.propTypes = propTypes;
Editor.defaultProps = defaultProps;
export default Editor;