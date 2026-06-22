---
name: view-guide
description: Guide for writing UI code in this project using the Lew42/View framework. Use when writing page.js files, creating View components, constructing HTML elements, or any time the user asks how to build UI. Covers the preferred minimal element helpers (el, div, p, h1, h2, style), the captor pattern, chaining API, and anti-patterns to avoid. This project does NOT use React, Vue, or JSX.
---

# View System Guide

This project uses a custom reactive framework called **Lew42**. There is no React, Vue, JSX, or template language — UI is built imperatively in plain JavaScript using the `View` class and a small set of element helper functions.

---

## The Captor Pattern

The core mechanic is the **captor**: whichever View is currently "active" automatically receives any elements created inside a function passed to it. You never manually call `parent.append(child)` for normal tree construction — you just create elements inside a function and they attach themselves.

```js
div.c("card", () => {
    h1("Title");        // auto-appended to .card
    p("Body text.");    // auto-appended to .card
});
```

The function argument (`() => { ... }`) is the capturing context. Inside it, every element created is appended to the parent in order.

---

## Preferred Element Helpers

Keep imports to a **minimal set**. These are the helpers you should reach for first:

| Helper | Tag | Notes |
|--------|-----|-------|
| `el(tag, ...)` | any | Generic. Use this for everything not listed below. |
| `div(...)` | `<div>` | Default block container. |
| `p(...)` | `<p>` | Paragraphs. Supports backtick → `<code>` auto-wrapping. |
| `h1(...)` | `<h1>` | Page-level heading. |
| `h2(...)` | `<h2>` | Section heading. |
| `style(...)` | `<style>` | Injects into `<head>`. |
| `section(...)` | `<section>` | Optional; use for semantic grouping. |

**For anything else** (`ul`, `li`, `a`, `button`, `span`, `input`, `table`, etc.) — use `el()`:

```js
el("ul", () => {
    el("li", "Item one");
    el("li", "Item two");
});

el("a", "Click here").href("/some/path");
el("button", "Submit").click(() => doSomething());
```

Do **not** import the full list of named helpers just because they exist. `el("tag")` is clearer intent and keeps imports lean.

---

## The `.c()` Shorthand

Every helper has a `.c()` variant: **classes come first, content comes after**. Use it when you'd otherwise have to chain `.ac()` at the end of a long block.

```js
// equivalent:
div("content").ac("card featured");
div.c("card featured", "content");

// .c() shines when content is a function:
div.c("sidebar", () => {
    h2("Navigation");
    el("nav", () => { /* ... */ });
});

// el.c() takes tag first, then classes:
el.c("button", "primary large", "Save");
```

---

## Chaining API

Every method returns `this`, so calls chain:

```js
el("a", "Learn more")
    .ac("cta-link")
    .attr("href", "/docs")
    .attr("target", "_blank")
    .click(e => track("cta-click"));
```

Key methods:

| Method | Purpose |
|--------|---------|
| `.ac("cls")` | Add class(es) |
| `.rc("cls")` | Remove class(es) |
| `.tc("cls")` | Toggle class(es) |
| `.attr(name, val)` | Set/get attribute |
| `.href(url)` | Shorthand for `.attr("href", url)` |
| `.text(val)` | Set/get `textContent` |
| `.html(val)` | Set/get `innerHTML` |
| `.style(prop, val)` | Set/get inline style; also accepts an object |
| `.on(event, cb)` | Add event listener |
| `.click(cb)` | Shorthand for `.on("click", cb)` |
| `.append(...)` | Manually append child(ren) |
| `.empty(...)` | Clear and re-render content |
| `.hide()` / `.show()` | Toggle `display` |
| `.remove()` | Remove from DOM |
| `.load(meta, "file.js")` | Async-import and append a module |

---

## `p()` and Backtick Auto-wrapping

`p()` (and `p.c()`) run content through `backtick_append`, which converts `` `code` `` spans in strings into real `<code>` elements:

```js
p("Call `el()` for any tag not in the preferred set.");
// renders: Call <code>el()</code> for any tag not in the preferred set.
```

---

## Pages

A page file runs at module load time. The captor is set to the page root before the module executes, so top-level element calls attach directly to the page.

```js
import app, { el, div, p, h1, h2 } from "/app.js";
app.$root.ac("page");

h1("My Page");

div.c("content", () => {
    h2("Section");
    p("Some text with `inline code` here.");
    el("ul", () => {
        el("li", "First item");
        el("li", "Second item");
    });
});
```

---

## Custom Components

Extend `View` to create reusable, stateful components. The `render()` method runs inside the captor automatically.

```js
import { View } from "/framework/View.js";
import app, { el, div, p } from "/app.js";

class MyCard extends View {
    render() {
        div.c("card-inner", () => {
            el("h3", this.title);
            p(this.body);
        });
    }
}

new MyCard({ title: "Hello", body: "World" });
```

---

## What NOT to do

- Do not use `innerHTML` to build structure — use element helpers and the captor pattern.
- Do not import the full list of named helpers (`ul`, `li`, `span`, `button`, etc.) when `el()` covers the need.
- Do not use React, Vue, JSX, or any template system — this framework IS the UI layer.
- Do not manually call `appendChild` — use `.append()` or the captor function pattern.
