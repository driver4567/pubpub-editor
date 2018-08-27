const doc = {
	type: 'doc',
	attrs: {
		meta: {}
	},
	content: [
		{
			type: 'heading',
			attrs: {
				level: 1,
			},
			content: [
				{
					type: 'text',
					text: 'Introduction',
				}
			]
		},
		{
			type: 'paragraph',
			content: [
				{
					type: 'text',
					text: 'Welcome to my introduction!',
				},
				{
					type: 'text',
					text: 'This section is bold and I think that is pretty nifty.',
					marks: [{ type: 'strong' }],
				}
			]
		},
		{
			type: 'image',
			attrs: {
				url: 'https://assets.pubpub.org/_testing/41517872250621.png',
				caption: 'Hello there!',
			},
		},
		{
			type: 'heading',
			attrs: {
				level: 2,
			},
			content: [
				{
					type: 'text',
					text: 'Whatever',
				}
			]
		},
		{
			type: 'heading',
			attrs: {
				level: 3,
			},
			content: [
				{
					type: 'text',
					text: 'Video Section',
				}
			]
		},
		{
			type: 'video',
			attrs: {
				url: 'http://techslides.com/demos/sample-videos/small.mp4',
				caption: 'Most videos are colorful - but some are black and white.',
			},
		},
		{
			type: 'iframe',
			attrs: {
				url: 'https://www.youtube.com/embed/RK1K2bCg4J8',
				caption: 'Hello there!',
				align: 'full',
				height: 350,
			},
		},
	]
};

export default doc;