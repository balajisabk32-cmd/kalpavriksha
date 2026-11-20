"use client";

import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

/**
 * Question and solution text: line breaks as written, tables, images from our
 * own storage, and maths ($…$). Raw HTML in the source is not rendered.
 */
export function PracticeMarkdown({ text, className = "" }: { text: string; className?: string }) {
  return (
    <div className={`practice-md min-w-0 break-words text-[15px] leading-relaxed [&_.katex-display]:overflow-x-auto [&_.katex-display]:py-1 [&_p+p]:mt-2 [&_table]:my-2 [&_table]:block [&_table]:overflow-x-auto [&_td]:border [&_td]:border-line [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-line [&_th]:px-2 [&_th]:py-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        skipHtml
        components={{
          img: ({ src, alt }) =>
            typeof src === "string" && src.startsWith("/api/practice/asset/") ? (
              // eslint-disable-next-line @next/next/no-img-element -- our own signed-in image route; sizes vary per diagram
              <img src={src} alt={alt || ""} loading="lazy" decoding="async" className="my-2 block h-auto max-w-full rounded-lg bg-white p-1" />
            ) : null,
          a: ({ children }) => <span>{children}</span>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}
