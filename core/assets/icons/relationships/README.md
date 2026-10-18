# Relationship symbols

Monochrome SVG symbols for compact relationship annotations. Each uses a centered
24 × 24 viewBox, currentColor strokes, and no text, embedded fonts, or gradients.
Geometry lives here once; product views import the artwork rather than copying
paths. The larger shaded toolbar icons remain in ../tools/.

Aether CAD's sketch/constraint-icons.ts adapts these assets for its SVG canvas;
constraint-catalog.ts maps supported model relationships to symbols. Relationship
hover/focus behavior is separate in relationships/interaction.ts, with actual
sketch references projected by sketch/constraint-geometry.ts. Other CAD views can
supply their own participants without changing mate/constraint/support semantics.
