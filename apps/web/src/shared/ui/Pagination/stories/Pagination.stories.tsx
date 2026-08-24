import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Pagination } from '../core/Pagination'

const meta = {
  title: 'Shared/UI/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  args: {
    onPageChange: () => {},
    page: 1,
    totalPages: 1,
  },
  argTypes: {
    page: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
      },
    },
    totalPages: {
      control: { type: 'number' },
      table: {
        type: { summary: 'number' },
      },
    },
  },
  render: (args) => {
    const [page, setPage] = useState(args.page)

    return <Pagination {...args} onPageChange={setPage} page={page} />
  },
} satisfies Meta<typeof Pagination>

type TStory = StoryObj<typeof meta>

const DocsPreview: TStory = {
  tags: ['!dev'],
}

const Middle: TStory = {
  args: {
    page: 8,
    totalPages: 16,
  },
}

const FirstPage: TStory = {
  args: {
    page: 1,
    totalPages: 16,
  },
}

const LastPage: TStory = {
  args: {
    page: 16,
    totalPages: 16,
  },
}

const FewPages: TStory = {
  args: {
    page: 3,
    totalPages: 5,
  },
}

export { DocsPreview, FewPages, FirstPage, LastPage, Middle }
export default meta
