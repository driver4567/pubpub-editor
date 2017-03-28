import React, { PropTypes } from 'react';

import Autocomplete from './Autocomplete';
import { RichEditor as ProseEditor } from '../prosemirror-setup';
import ReactDOM from 'react-dom';

/*
Props outline:
<Editor
	mentionsComponent={component}
	files={array}, // Array of file objects.
	handleFileUpload={function}
	fileUploadComplete={object} // Data about completed file upload
	onChange={function} // To update editorState which is managed above Editor
	initialState={object}
	/>
*/


export const RichEditor = React.createClass({
	propTypes: {
		initialContent: PropTypes.object,
		onChange: PropTypes.func,
		localUsers: PropTypes.array,
		localPubs: PropTypes.array,
	},

	getInitialState() {
		return {
			// docJSON: null,
			// fileMap: null,
			visible: undefined,
			top: 0,
			left: 0,
			input: '',
			menuTop: 0,
			inlineCenter: 0, 
			inlineTop: 0,
		};
	},

	componentWillMount() {
	},

	componentDidMount() {
		this.createEditor(null);
	},

	componentWillUpdate(nextProps) {

	},

	onChange() {
		this.props.onChange(this.editor.view.state.toJSON().doc);
		// this.props.onChange(this.editor.view.state.doc);
		this.updateCoordsForMenus();
	},

	updateCoordsForMenus: function() {
		const currentPos = this.editor.view.state.selection.$to.pos;
		const container = document.getElementById('rich-editor-container');
		const menuTop = this.editor.view.coordsAtPos(currentPos).top - container.getBoundingClientRect().top + 5;
		
		if (!this.editor.view.state.selection.$cursor) {
			const currentFromPos = this.editor.view.state.selection.$from.pos;
			const currentToPos = this.editor.view.state.selection.$to.pos;
			const left = this.editor.view.coordsAtPos(currentFromPos).left - container.getBoundingClientRect().left;
			const right = this.editor.view.coordsAtPos(currentToPos).right - container.getBoundingClientRect().left;
			const inlineCenter = left + ((right - left) / 2);
			const inlineTop = this.editor.view.coordsAtPos(currentFromPos).top - container.getBoundingClientRect().top;
			return this.setState({
				menuTop: menuTop,
				inlineCenter: inlineCenter,
				inlineTop: inlineTop,
			});			
		}

		return this.setState({ 
			menuTop: menuTop,
			inlineTop: 0,
			inlineCenter: 0,
		});
	},

	getMarkdown() {
		return this.editor.toMarkdown();
	},

	getJSON() {
		return this.editor.toJSON();
	},

	createEditor(docJSON) {
	const {handleFileUpload, onError, mentionsComponent, initialContent} = this.props;

	if (this.editor) {
	  this.editor1.remove();
	}
	const place = ReactDOM.findDOMNode(this.refs.container);
		this.editor = new ProseEditor({
			place: place,
			contents: initialContent,
			// components: {
			// 	suggestComponent: mentionsComponent,
			// },
			handlers: {
				createFile: handleFileUpload,
				captureError: onError,
				onChange: this.onChange,
				updateMentions: this.updateMentions,
			}
		});
	},

	updateMentions(mentionInput) {
		if (!!mentionInput) {
			setTimeout(()=>{
				const container = document.getElementById('rich-editor-container');
				const mark = document.getElementsByClassName('mention-marker')[0];
				const top = mark.getBoundingClientRect().bottom - container.getBoundingClientRect().top;
				const left = mark.getBoundingClientRect().left - container.getBoundingClientRect().left;
				this.setState({
					visible: true,
					top: top,
					left: left,
					input: mentionInput,
				});
			}, 0);
		} else {
			this.setState({ visible: false });
		}
	},


	onSelection: function(selectedObject) {
		console.log(selectedObject)
		return this.editor.createMention();
	},

	render: function() {
		return (
			<div style={{ position: 'relative' }} id={'rich-editor-container'}>
				<Autocomplete 
					top={this.state.top} 
					left={this.state.left} 
					visible={this.state.visible} 
					input={this.state.input} 
					onSelection={this.onSelection}
					localUsers={this.props.localUsers}
					localPubs={this.props.localPubs} />
				
				{!!this.state.menuTop &&
					<span style={{ position: 'absolute', left: '-24px', top: this.state.menuTop, cursor: 'pointer' }} className={'pt-icon-standard pt-icon-add'} />
				}
				{!!this.state.inlineTop &&
					<div className={'pt-card pt-elevation-0 pt-dark'} style={{ position: 'absolute', height: '35px', lineHeight: '35px', padding: '0px 1em', top: (this.state.inlineTop - 40), left: this.state.inlineCenter }}>Formatting</div>
				}

				<div ref="container" className="pubEditor" id="pubEditor"></div>
			</div>
		);
	}

});

export default RichEditor;
