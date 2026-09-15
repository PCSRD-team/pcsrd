/**
 * Compatibility path.
 *
 * The kit was split into one file per component group; this module keeps
 * the original import path working for the call sites that predate the
 * split. New code imports from `@/components/ui` (the barrel) or from the
 * specific file. Nothing is defined here.
 */
export { Section, SectionHeading, Container, Stack, Cluster, Grid, Rule, PageHeader } from './layout';
export { Panel, Card, CardBody, CardFooter, CardMedia, RuledList, RuledListItem } from './card';
export {
  Button,
  ButtonLink,
  IconButton,
  IconLink,
  IconSlot,
  buttonClasses,
  type ButtonTone,
  type ButtonSize,
} from './button';
export { Badge, StatusBadge, VerificationBadge, type BadgeTone } from './badge';
export { DefinitionList, type DefinitionItem } from './definition-list';
export { Prose, Eyebrow, Lede, Heading, Caption, Meta } from './typography';
