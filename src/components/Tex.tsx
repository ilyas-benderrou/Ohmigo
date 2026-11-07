import katex from 'katex';
import 'katex/dist/katex.min.css';
import { Fragment, useMemo } from 'react';
import { splitMath } from '../engine/math';

/** Formule LaTeX rendue avec KaTeX (fonctionne hors ligne : polices incluses dans le build). */
export function Tex({ math, display = false, className = '' }: { math: string; display?: boolean; className?: string }) {
  const html = useMemo(() => katex.renderToString(math, { displayMode: display, throwOnError: false, output: 'htmlAndMathml' }), [math, display]);
  const Tag = display ? 'div' : 'span';
  return (
    <Tag
      className={`${display ? 'relative w-full overflow-x-auto overflow-y-hidden [&_.katex-display]:my-1' : ''} ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );;
}

/** Texte pédagogique contenant des formules entre dollars : « As-tu calculé $R_{eq}$ ? ». */
export function RichText({ text }: { text: string }) {
  return (
    <>
      {splitMath(text).map((p, i) => (p.type === 'math' ? <Tex key={i} math={p.value} /> : <Fragment key={i}>{p.value}</Fragment>))}
    </>
  );
}
