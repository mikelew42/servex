---
description: Code style conventions for this project. Always active.
---

## JavaScript Naming

- **snake_case** for variables, methods, and parameters — not camelCase
- **Prefer single words** over compound names to minimize underscores (`render` not `render_project`, `start` not `start_project`)
- **PascalCase** for class names
- **SCREAMING_SNAKE_CASE** for constants
- Leave built-in protocol methods as-is (`toJSON`, `toString`, etc.)

## CSS Units

- Use `em`, not `rem`. The project's root font size is hyper-responsive and makes `rem` values too small for text.
