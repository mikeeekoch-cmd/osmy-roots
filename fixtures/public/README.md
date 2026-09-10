# Public test fixtures

Everything in this folder is **synthetic**. It exists so the repository's tests run on a
fresh public clone with no private family material.

| File | Purpose |
| --- | --- |
| `synthetic-family.json` | Invented five-generation family in the prior project's seed format. Includes a same-name distractor (`P009`), a deliberately dangling relationship endpoint (`P099`), and a declared/actual person-count mismatch. |
| `placeholder-portrait.png` | A plain generated gradient. Not a photograph of anyone. |
| `alex-morgan-contribution.txt` | The shared acceptance example sentence from `docs/PROTOTYPE-CONTRACT.md`. |

A synthetic fixture can prove that code behaves correctly. It cannot demonstrate a real
family finding, a real archive match, or compatibility with any real chat-export format.
