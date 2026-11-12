# theming Delta

## MODIFIED Requirements

### Requirement: Exact palette
The system SHALL keep Qingxin blue primaries (`#3B82F6` light, `#60A5FA` dark) and text/secondary tokens. Canvas background MAY use a pale-sky light wash and a deep-navy dark wash. Atmosphere MAY add coral, teal, and gold glows. The system SHALL NOT adopt a purple sample-slide gradient as the brand.

#### Scenario: Light tokens keep blue primary
- **WHEN** the resolved appearance is light
- **THEN** `--qx-primary` is `#3B82F6` and the canvas is not stark un-tinted white-only identity

#### Scenario: Dark tokens keep blue primary
- **WHEN** the resolved appearance is dark
- **THEN** `--qx-primary` is `#60A5FA`
