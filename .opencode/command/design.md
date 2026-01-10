---
description: What problem does this interface solve? Who uses it?
---

# Design: Creative Frontend Implementation

**Input**: Page/component name or description (e.g., "landing-page", "pricing-section", "dashboard layout")
**Context**: RULES.md for project constraints, design system if exists
**Mode**: Creative - Focuses on distinctive visual design outside TDD workflow

## Purpose

This command creates distinctive, production-grade frontend interfaces with high design quality. Use when building webpage designs, marketing pages, or visual components where creative exploration is more important than test coverage.

**When to Use /design**:
- Landing pages, marketing pages, portfolio sites
- Visual redesigns and layout improvements
- Creative components with strong aesthetic requirements
- Rapid prototyping of UI concepts
- Any webpage where visual quality trumps test coverage

**When NOT to Use /design**:
- Application logic requiring TDD
- Backend API integrations
- Complex state management
- Features requiring comprehensive test coverage
- Use `/spec` → `/plan` → `/implement` workflow instead

---

## Execution Flow

1. **Input Processing**: Parse the design target.
   - Extract page/component name from input
   - Determine if this is a new page or redesign
   - Identify target framework (React, Vue, HTML/CSS, Hugo, etc.)

2. **Project Impact Analysis**: Understand dependencies and cascading effects.
   
   **CRITICAL - Analyze how changes affect the broader project:**
   
   ### Template-Based Systems (Hugo, Jekyll, etc.)
   - **Shared Templates**: Identify if the target uses shared templates/layouts/partials
   - **Cascade Analysis**: Map which other pages will be affected by template changes
   - **Scope Decision**: Determine if this is:
     - Page-specific override (create new template variant)
     - Template-wide change (affects multiple pages intentionally)
     - Partial/component change (affects all instances)
   - **Document Impact**: List all affected pages/sections before proceeding
   
   ### Component-Based Systems (React, Vue, etc.)
   - **Component Usage**: Search for all instances where the component is used
   - **Props/API Impact**: Identify if changes affect component interface
   - **Dependency Chain**: Check for parent/child component relationships
   - **Global Styles**: Note if changes affect global CSS/theme variables
   
   ### Static Site Generators
   - **Hugo Specific**:
     - Check `layouts/_default/`, `layouts/partials/`, `layouts/shortcodes/`
     - Identify which `.html` templates are being modified
     - Verify content type and section-specific overrides
     - Test representative pages from each affected section
   - **Jekyll/11ty**: Similar template hierarchy analysis
   
   **⚠️ CHECKPOINT**: Before proceeding, document:
   - [ ] Which files will be modified
   - [ ] Which pages/components will be affected
   - [ ] Whether this is isolated or has cascading effects
   - [ ] Any required testing across affected areas
   
   **If cascading changes detected:**
   - Inform user of the scope and get confirmation
   - Example: "This template change will affect all blog posts (23 pages). Proceed with global change or create page-specific override?"

3. **Constitutional Review**: Load project constraints.
   - Read RULES.md for:
     - Approved frameworks and libraries
     - Design system components (if exists)
     - Brand guidelines or color palettes
     - Accessibility requirements (WCAG standards)
     - Typography constraints
   - Identify any reusable components that MUST be used
   - Note any off-limits approaches

4. **Design Thinking Phase** *(MANDATORY - DO NOT SKIP)*:

   **Before writing any code, answer these questions:**

   ### Context Understanding
   - **Purpose**: What problem does this interface solve? Who uses it?
   - **User Needs**: What actions should users take? What information do they need?
   - **Success Criteria**: What does "good" look like for this design?
   - **Technical Constraints**: Framework, performance, accessibility requirements

   ### Aesthetic Direction
   - **Tone Selection**: Choose ONE bold direction:
     - Examples: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, 
       luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, 
       art deco/geometric, soft/pastel, industrial/utilitarian
     - Use these for inspiration but design one true to the context
   - **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?
   - **Conceptual Direction**: Clear vision executed with precision
     - Bold maximalism OR refined minimalism both work
     - The key is intentionality, not intensity

   ### Creative Decisions
   - **Typography**: Distinctive font choices (NOT Inter, Roboto, Arial, system fonts)
     - Display font: [Your choice]
     - Body font: [Your choice]
     - Rationale: [Why these fonts match the aesthetic]
   - **Color Palette**: Cohesive scheme with emotional impact
     - Dominant colors: [2-3 colors]
     - Accent colors: [1-2 colors]
     - Rationale: [Why this palette supports the tone]
   - **Spatial Approach**: Layout strategy
     - Grid system: [Symmetric, asymmetric, broken grid, etc.]
     - Whitespace: [Generous, controlled density, etc.]
     - Flow: [Vertical, diagonal, overlapping, etc.]

   **✋ CHECKPOINT**: Document your design thinking above before proceeding to implementation.

5. **Implementation Strategy**: Choose approach based on aesthetic vision.

   **Match implementation complexity to aesthetic vision:**
   - **Maximalist/Elaborate Designs**: Extensive animations, layered effects, complex interactions
   - **Minimalist/Refined Designs**: Restraint, precision, subtle details, careful spacing
   - **Elegance comes from executing the vision well**, not from complexity

   **Implementation Components**:
   - Typography setup (font imports, scales, weights)
   - Color system (CSS variables for consistency)
   - Layout structure (grid, flex, positioning)
   - Visual details (backgrounds, textures, effects)
   - Motion design (animations, transitions, micro-interactions)

6. **Constitutional Compliance Check**: Verify against project rules.

   **CRITICAL - Verify you are following RULES.md:**
   - [ ] Using approved frameworks/libraries only
   - [ ] Reusing design system components where required
   - [ ] Following accessibility standards (WCAG AA minimum)
   - [ ] Respecting brand guidelines if specified
   - [ ] Using approved icon sets or image sources

   **If constitutional conflict exists:**
   - Document the conflict clearly
   - Propose either: (a) adjustment to design, or (b) exception request
   - Get user approval before proceeding

7. **Build the Interface**: Write production-grade code.

   **Focus Areas**:

   ### Typography
   - Choose fonts that are beautiful, unique, and interesting
   - Avoid generic fonts (Arial, Inter, Roboto, system fonts)
   - Use distinctive choices that elevate aesthetics
   - Pair distinctive display font with refined body font
   - Implement proper scales, weights, line-heights

   ### Color & Theme
   - Commit to cohesive aesthetic
   - Use CSS variables for consistency
   - Dominant colors with sharp accents (not evenly distributed)
   - Create emotional impact through color choices

   ### Motion & Animation
   - Use animations for effects and micro-interactions
   - Prioritize CSS-only solutions for HTML
   - Use Motion library for React when available
   - High-impact moments: orchestrated page load with staggered reveals
   - Use animation-delay for choreographed sequences
   - Scroll-triggering and hover states that surprise

   ### Spatial Composition
   - Unexpected layouts (asymmetry, overlap, diagonal flow)
   - Grid-breaking elements where appropriate
   - Generous negative space OR controlled density
   - Intentional visual hierarchy

   ### Backgrounds & Visual Details
   - Create atmosphere and depth (not solid colors)
   - Add contextual effects matching aesthetic
   - Consider: gradient meshes, noise textures, geometric patterns
   - Layered transparencies, dramatic shadows, decorative borders
   - Custom cursors, grain overlays where appropriate

   **AVOID Generic AI Aesthetics**:
   - ❌ Overused fonts (Inter, Roboto, Arial, system fonts)
   - ❌ Cliched colors (purple gradients on white)
   - ❌ Predictable layouts and component patterns
   - ❌ Cookie-cutter design lacking context-specific character

   **Creative Interpretation**:
   - Make unexpected choices genuinely designed for context
   - No two designs should be the same
   - Vary between light/dark themes, different fonts, different aesthetics
   - NEVER converge on common choices (e.g., Space Grotesk) across projects

8. **Quality Review**: Verify production-readiness.

   **Code Quality Checklist**:
   - [ ] Production-grade and functional
   - [ ] Visually striking and memorable
   - [ ] Cohesive with clear aesthetic point-of-view
   - [ ] Meticulously refined in every detail
   - [ ] Responsive across viewport sizes
   - [ ] Accessible (keyboard navigation, semantic HTML, ARIA where needed)
   - [ ] Performant (optimized assets, efficient animations)

   **Design Quality Checklist**:
   - [ ] Typography is distinctive and well-executed
   - [ ] Color palette is cohesive and intentional
   - [ ] Layout is unexpected or memorable
   - [ ] Motion design enhances experience
   - [ ] Visual details create depth and atmosphere
   - [ ] Overall aesthetic matches the conceptual direction

9. **Document Design Decisions**: Create lightweight documentation.

   Add a brief design note at the top of the main file:
   ```
   /**
    * Design: [Page/Component Name]
    * 
    * Aesthetic Direction: [Brief description of tone/concept]
    * Typography: [Font choices and rationale]
    * Color Palette: [Main colors used]
    * Key Features: [Distinctive elements]
    * 
    * Accessibility: WCAG [AA/AAA] compliant
    * Responsive: Mobile-first / Desktop-first
    */
   ```

10. **Preview & Iterate** *(OPTIONAL)*:

   Offer to create preview or iterate:
   - "Design complete. Would you like me to:"
     - "1. Create a preview/demo file"
     - "2. Iterate on a specific aspect (colors, typography, layout)"
     - "3. Create responsive variants"
     - "4. Add additional animations/interactions"

11. **Commit Work**: Save the design implementation.

    - Execute: `git add [files] && git commit -m "Design: [page-name] - [brief aesthetic description]"`
    - Example: `git commit -m "Design: landing-page - Brutalist minimalism with bold typography"`

---

## Design Principles

### Intentionality Over Intensity

**Both bold maximalism and refined minimalism work - the key is intentionality, not intensity.**

- **Maximalist Design**: Requires elaborate code, extensive animations, complex layering
- **Minimalist Design**: Requires restraint, precision, subtle details, careful spacing
- **Elegance**: Comes from executing your chosen vision well

### Creative Freedom Within Constraints

**Constitutional compliance is mandatory, creativity is within those bounds:**

1. **Must Follow**: RULES.md requirements (frameworks, accessibility, brand guidelines)
2. **Must Reuse**: Existing design system components where specified
3. **Creative Freedom**: Typography, color, layout, motion, visual effects (within constraints)

### Context-Specific Design

**No two designs should look the same:**

- Each design should reflect its specific purpose and audience
- Vary aesthetics across projects (light/dark, fonts, styles)
- Avoid falling into common patterns (same fonts, same colors, same layouts)
- Make choices that feel genuinely designed for this specific context

---

## Framework-Specific Notes

### React
- Use styled-components, emotion, or Tailwind (check RULES.md)
- Use Framer Motion for complex animations (if approved)
- Prefer CSS-first for simple animations
- Component composition for reusability

### HTML/CSS
- Modern CSS (Grid, Flexbox, Custom Properties)
- CSS animations for motion
- Semantic HTML5
- Progressive enhancement

### Vue
- Scoped styles or CSS modules
- Transition components for animations
- Composition API for logic
- Vue-specific animation libraries if needed

### Next.js/Gatsby
- Optimize images (next/image, gatsby-image)
- Consider SSG/SSR implications
- Font optimization (next/font)
- Performance budgets

---

## Accessibility Requirements

**WCAG 2.1 AA is the MINIMUM, even for creative designs:**

### Must Have
- [ ] Color contrast 4.5:1 minimum for text
- [ ] Keyboard navigation for all interactions
- [ ] Semantic HTML (nav, main, section, article, etc.)
- [ ] Alt text for images
- [ ] Focus indicators visible and clear
- [ ] Text resizable to 200% without loss of functionality

### Consider
- [ ] Reduced motion preferences (prefers-reduced-motion)
- [ ] Screen reader compatibility (test with VoiceOver/NVDA)
- [ ] High contrast mode support
- [ ] Touch target sizing (44x44px minimum)

**Creative designs must still be inclusive designs.**

---

## Common Pitfalls to Avoid

### ❌ Constitutional Violations
- Using unapproved libraries or frameworks
- Ignoring existing design system components
- Skipping accessibility requirements
- Missing required translations (check RULES.md)

### ❌ Generic AI Aesthetics
- Default to Inter/Roboto fonts
- Purple gradient on white background
- Card-grid-button layouts with no variation
- Same design patterns across all projects

### ❌ Incomplete Implementation
- Forgot responsive behavior
- Missing hover/focus states
- No loading states or error handling
- Animations cause motion sickness (no prefers-reduced-motion)

### ❌ Over/Under-Engineering
- Maximalist vision with minimal code (looks unfinished)
- Minimalist vision with excessive effects (looks confused)
- Animation for animation's sake (no purpose)

---

## Creative Inspiration

### Aesthetic Directions (Choose One, Execute Fully)

**Minimal/Refined**:
- Brutalist minimalism (raw, unpolished, monospace fonts, stark contrast)
- Swiss/International style (grid-based, sans-serif, asymmetric balance)
- Japanese minimalism (whitespace, natural materials, subtle elegance)
- Scandinavian clean (functional, light, airy, restrained color)

**Bold/Expressive**:
- Maximalist chaos (layered, dense, vibrant, overwhelming in intent)
- Retro-futuristic (neon, gradients, chrome, 80s/Y2K vibes)
- Art Deco (geometric, luxury, symmetry, gold accents)
- Grunge/Raw (textured, imperfect, hand-made feel, authentic)

**Conceptual**:
- Editorial/Magazine (typography-first, hierarchy, columns, editorial feel)
- Organic/Natural (curves, earth tones, flowing, biomorphic)
- Industrial/Utilitarian (functional, monochrome, geometric, systematic)
- Playful/Toy-like (rounded, bright, friendly, whimsical)

**Use these as starting points, not templates. Design for your specific context.**

---

## Example Workflow

```
User: /design landing-page for a luxury watch brand

Agent:
1. Input Processing: Landing page for luxury watch brand
2. Project Impact Analysis: [Checks if using shared templates, identifies this is standalone page]
3. Constitutional Review: [Loads RULES.md, checks for design system]
4. Design Thinking:
   - Purpose: Convert visitors to explore catalog, convey luxury/craftsmanship
   - Tone: Luxury/refined with editorial sophistication
   - Typography: Playfair Display (serif, elegant) + Lato (clean sans)
   - Colors: Deep navy (#0A1128), gold accents (#D4AF37), cream (#F8F6F0)
   - Layout: Asymmetric hero with large product imagery, editorial grid below
   - Differentiation: Parallax scrolling with watch movement, gold particle effects
5. Implementation: [Builds production code with above aesthetic]
6. Constitutional Check: ✅ Accessibility WCAG AA, ✅ React approved, ✅ No conflicts
7. Quality Review: [Validates code and design quality]
8. Documentation: [Adds design note to component]
9. Commit: git commit -m "Design: landing-page - Luxury editorial with parallax"
```

---

## Success Criteria

A successful design implementation:
1. ✅ **Functional**: Works flawlessly across devices and browsers
2. ✅ **Distinctive**: Has a clear, memorable aesthetic identity
3. ✅ **Constitutional**: Follows all RULES.md requirements
4. ✅ **Accessible**: Meets WCAG 2.1 AA standards minimum
5. ✅ **Intentional**: Every choice serves the conceptual direction
6. ✅ **Production-Ready**: Code is clean, performant, maintainable

---

**Remember**: You are capable of extraordinary creative work. Don't hold back. Show what can truly be created when thinking outside the box and committing fully to a distinctive vision within project constraints.
