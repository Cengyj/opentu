## Context

`exportAllPPTFrames` partitions canvas elements, `addFrameSlide` creates one slide, and `exportFramesToPPT` writes the PPTX. The image-first contract makes the element referenced by `pptMeta.slideImageId` or the current slide-image association the required content for that page. Today the exporter has only a boolean slide result and suppresses both required-image and optional-element errors.

## Goals / Non-Goals

- Goals: prevent false full-success reports, block unusable image-first exports, and make tolerated legacy omissions observable.
- Non-Goals: retry remote requests, change cache/CDN policy, add a new export format, redesign slides, alter media embedding limits/fallbacks, persist export history, or modify board/task schemas.

## Decisions

- Resolve the primary slide image using the existing PPT association helpers rather than geometry or element position alone.
- A failed required primary image produces a typed page failure. The public export rejects before `writeFile`, transition injection, or download.
- Other element conversion failures are collected as non-critical omissions. If all required page content succeeds, the file may be written and the public API returns counts/page references so the caller reports partial success.
- Background-image failure remains non-blocking because it is not the image-first page's primary content, but it is included in the omission result.
- UI analytics use an error/result category and counts only. They do not include image URLs, prompts, provider responses, credentials, or task IDs.

## Invariants

- Frame/page order and transition order remain identical.
- Successful exports preserve current dimensions, media options, filename normalization, and output path.
- No export attempt mutates the board, task storage, cache entries, or PPT metadata.
- A failed blocking export leaves the canvas and all source references available for retry.

## Risks / Trade-offs

- Blocking on a transient remote image failure is stricter than today's download; clear retry feedback and cached/data URL coverage mitigate this.
- Primary-image association can drift in legacy data; tests must cover explicit ID, current generated image association, and legacy pages with no declared primary image.
- Partial warnings can be noisy for unsupported decorative elements; results should aggregate by page/count rather than emit one toast per element.

## Verification And Rollback

- Red/green tests cover primary 404/conversion failure, no `writeFile`/download on blocking failure, legacy omission warnings, all-success export, transitions, and privacy-safe analytics.
- Render a synthetic successful and partial legacy deck with `render_slides.py`; run `slides_test.py` and inspect every page.
- Browser verification covers success, failure, retry, partial success, repeated activation while pending, Chinese/English, and offline cached input.
- Rollback restores the previous result type/caller handling; no stored data cleanup is required.
