import { mergeAttributes, Node } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import dynamic from 'next/dynamic'

const ImageBlockComponent = dynamic(() => import('./ImageBlockComponent'), {
  ssr: false,
})

export default Node.create({
  name: 'blockImage',
  group: 'block',
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      blockObject: {
        default: null,
      },
      size: {
        width: 300,
      },
      alignment: {
        default: 'center',
      },
      // Percentage width preset ('25' | '50' | '75' | '100'). null = legacy
      // behaviour (the pixel width stored in `size`), so old content is unchanged.
      widthPreset: {
        default: null,
      },
      alt: {
        default: '',
      },
      unsplash_url: {
        default: null,
      },
      unsplash_photographer_name: {
        default: null,
      },
      unsplash_photographer_url: {
        default: null,
      },
      unsplash_photo_url: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'block-image',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['block-image', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockComponent as any)
  },
})
