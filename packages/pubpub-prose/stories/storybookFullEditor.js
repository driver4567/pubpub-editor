import React from 'react';
import RichEditor from '../src/editorComponents/RichEditor';
import MarkdownEditor from '../src/editorComponents/MarkdownEditor';
import { markdownToJSON, jsonToMarkdown } from '../src/markdown';

// requires style attributes that would normally be up to the wrapping library to require
require('@blueprintjs/core/dist/blueprint.css');
require('../style/base.scss');
require('../style/markdown.scss');

export const StoryBookFullEditor = React.createClass({
	getInitialState() {
		return {
			mode: 'rich',
			initialContent: undefined,
			content: undefined,
		};
	},

	setMarkdown: function() {
		const newMarkdown = this.state.content ? jsonToMarkdown(this.state.content) : '';
		this.setState({ 
			mode: 'markdown',
			initialContent: newMarkdown,
			content: newMarkdown,
		});
	},

	setRich: function() {
		const newJSON = markdownToJSON(this.state.content || '');
		this.setState({ 
			mode: 'rich',
			initialContent: newJSON,
			content: newJSON,
		});	
	},

	onChange: function(newContent) {
		this.setState({ content: newContent });
	},

	render: function() {
		const locals = {
			localUsers: [{ id: 1, username: 'travis', firstName: 'travis' }, { id: 2, username: 'trench', firstName: 'trench' }, { id: 3, username: 'traveller', firstName: 'traveller' }],
			localPubs: [{ id: 1, username: 'ThebestPub', firstName: 'The Best Pub' }, { id: 2, username: 'Over the Rainbow', firstName: 'Over the Rainbow' }, { id: 3, username: 'Time Traveller', firstName: 'Time Traveller' }],
			globalCategories: ['pubs', 'users'],
		};
		return (
			<div className={'pt-card pt-elevation-3'} style={{ padding: '0em', margin: '0em auto 2em', maxWidth: '850px' }}>
				<div style={{ backgroundColor: '#ebf1f5', padding: '0.5em', textAlign: 'right', borderBottom: '1px solid rgba(16, 22, 26, 0.15)' }}>
					<div className={'pt-button-group'}>
						<div className={`pt-button${this.state.mode === 'markdown' ? ' pt-active' : ''}`} onClick={this.setMarkdown}>Markdown</div>
						<div className={`pt-button${this.state.mode === 'rich' ? ' pt-active' : ''}`} onClick={this.setRich}>Rich</div>
					</div>
				</div>
				<div style={{ padding: '1em 2em' }}>
					{this.state.mode === 'markdown' &&
						<MarkdownEditor initialContent={this.state.initialContent} onChange={this.onChange} {...locals} />
					}
					{this.state.mode === 'rich' &&
						<RichEditor initialContent={this.state.initialContent} onChange={this.onChange} {...locals} />
					}
				</div>

			</div>

		);
	}
});

export default StoryBookFullEditor;
