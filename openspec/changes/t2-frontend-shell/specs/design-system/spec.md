# Spec Delta

## Purpose

Provides a shared zh-CN component kit so every screen keeps 44px targets, 16px key text, and consistent feedback states.

## ADDED Requirements

### Requirement: Kit primitives
The system SHALL provide Button, Card, Input, Textarea, Tag, Tabs, Switch, Toast, bottom Drawer, Modal, Skeleton, EmptyState, ListItem, and Icon components, documented on a `/kit` demo route.

#### Scenario: Kit route lists primitives
- **WHEN** a user opens `/kit`
- **THEN** each primitive listed above is visible and labeled in zh-CN

### Requirement: Touch and type scale
Interactive controls SHALL have a minimum height of 44px and key information text SHALL be at least 16px.

#### Scenario: Primary button height
- **WHEN** a primary Button renders
- **THEN** its tap target is at least 44 CSS pixels tall

### Requirement: Reduced motion
Micro-animations SHALL run by default and SHALL disable or reduce motion when `prefers-reduced-motion: reduce` is set.

#### Scenario: Reduced motion honored
- **WHEN** the user prefers reduced motion
- **THEN** breathing glow and enter transitions do not animate continuously
