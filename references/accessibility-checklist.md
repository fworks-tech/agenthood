# Accessibility Checklist (WCAG 2.1 AA)

## Keyboard
- [ ] All interactive elements keyboard accessible
- [ ] Visible focus indicators (minimum 2px outline)
- [ ] Logical tab order matching visual layout
- [ ] Skip links present where needed

## Screen Reader
- [ ] All images have alt text
- [ ] Form inputs associated with labels
- [ ] ARIA landmarks used for page structure
- [ ] Dynamic content announced via aria-live regions
- [ ] Heading hierarchy maintained (h1 -> h2 -> h3)

## Visual
- [ ] Color contrast: 4.5:1 normal text, 3:1 large text
- [ ] Information not conveyed by color alone
- [ ] Text zoom to 200% without loss of content

## Forms
- [ ] Validation errors associated with fields via aria-describedby
- [ ] Required fields marked with aria-required
- [ ] Error messages clear and actionable
