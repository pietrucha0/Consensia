import type { ReactNode } from 'react';

import {
  isSafeHref,
  type RichTextBlock,
  type RichTextDoc,
  type RichTextInline,
  type RichTextMark,
} from '../rich-text';

/**
 * Renders a validated article body as React elements. Only allow-listed nodes exist
 * in the type, so there is no HTML injection surface (no dangerouslySetInnerHTML).
 */
export function RichTextRenderer({ doc }: { doc: RichTextDoc }) {
  return <>{renderBlocks(doc.content)}</>;
}

function renderBlocks(blocks: RichTextBlock[]): ReactNode[] {
  return blocks.map((block, index) => renderBlock(block, index));
}

function renderBlock(block: RichTextBlock, key: number): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return <p key={key}>{renderInline(block.content)}</p>;
    case 'heading':
      return block.attrs.level === 2 ? (
        <h2 key={key}>{renderInline(block.content)}</h2>
      ) : (
        <h3 key={key}>{renderInline(block.content)}</h3>
      );
    case 'blockquote':
      return <blockquote key={key}>{renderBlocks(block.content)}</blockquote>;
    case 'bulletList':
      return (
        <ul key={key}>
          {block.content.map((item, i) => (
            <li key={i}>{renderBlocks(item.content)}</li>
          ))}
        </ul>
      );
    case 'orderedList':
      return (
        <ol key={key} start={block.attrs?.start}>
          {block.content.map((item, i) => (
            <li key={i}>{renderBlocks(item.content)}</li>
          ))}
        </ol>
      );
    case 'horizontalRule':
      return <hr key={key} />;
  }
}

function renderInline(nodes: RichTextInline[] | undefined): ReactNode[] {
  return (nodes ?? []).map((node, index) =>
    node.type === 'hardBreak' ? <br key={index} /> : <span key={index}>{applyMarks(node.text, node.marks ?? [])}</span>,
  );
}

function applyMarks(text: string, marks: RichTextMark[]): ReactNode {
  return marks.reduce<ReactNode>((children, mark) => {
    switch (mark.type) {
      case 'bold':
        return <strong>{children}</strong>;
      case 'italic':
        return <em>{children}</em>;
      case 'underline':
        return <u>{children}</u>;
      case 'strike':
        return <s>{children}</s>;
      case 'link':
        // Re-checked at render time: defense in depth against rows written outside the app.
        return isSafeHref(mark.attrs.href) ? (
          <a href={mark.attrs.href} target="_blank" rel="noopener noreferrer nofollow">
            {children}
          </a>
        ) : (
          children
        );
    }
  }, text);
}
