## 2025-05-18 - Accessibility in Navigation Tabs and Interactive Buttons
**Learning:** In SPAs using custom tab navigation and custom interactive cards/buttons without native element semantics or ARIA roles, keyboard users and screen readers cannot properly navigate or perceive active states. Using `role="tablist"`, `role="tab"`, `aria-selected`, `aria-label`, and keyboard focus styling (`:focus-visible`) improves accessibility significantly.
**Action:** Always verify `role`, `aria-selected`/`aria-label`, and `tabindex`/keyboard navigation for tab elements and custom interactive components.
