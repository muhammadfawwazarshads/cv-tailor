import type { CvDocument } from "../api";

/** HTML preview that mirrors the PDF renderer's layout. */
export function CvPreview({ cv }: { cv: CvDocument }) {
  return (
    <div className="paper-scroll">
      <article className="paper" aria-label="Pratinjau CV">
        <div className="p-name">{cv.name}</div>
        {cv.headline && <div className="p-headline">{cv.headline}</div>}
        {cv.contact.length > 0 && (
          <div className="p-contact">
            {cv.contact.map((c, i) => (
              <span key={i}>
                {i > 0 && " | "}
                {/^https?:\/\//.test(c) ? (
                  <a href={c} target="_blank" rel="noreferrer">
                    {c}
                  </a>
                ) : (
                  c
                )}
              </span>
            ))}
          </div>
        )}
        {cv.sections.map((s, si) => (
          <section className="p-section" key={si}>
            <div className="p-title">{s.title}</div>
            {s.kind === "paragraph" && <p>{s.text}</p>}
            {s.kind === "skills" && (
              <ul>
                {s.skills.map((g, i) => (
                  <li key={i}>
                    {g.category && <b>{g.category}: </b>}
                    {g.items}
                  </li>
                ))}
              </ul>
            )}
            {s.kind === "bullets" && (
              <ul>
                {s.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {s.kind === "entries" &&
              s.entries.map((e, i) => (
                <div className="p-entry" key={i}>
                  <div className="p-entry-head">
                    <span>{e.title}</span>
                    <span>{e.date}</span>
                  </div>
                  {e.subtitle && <div className="p-sub">{e.subtitle}</div>}
                  {e.bullets.length > 0 && (
                    <ul>
                      {e.bullets.map((b, j) => (
                        <li key={j}>{b}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
          </section>
        ))}
      </article>
    </div>
  );
}
