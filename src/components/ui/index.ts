/**
 * The shared component kit.
 *
 * Server Components unless the file says otherwise (`submit-button.tsx` and
 * `link-pending.tsx` are the two Client Components, each for one hook).
 * Every component here obeys the design system mechanically: radius 0, no
 * shadow, three rule weights, gold as a marking colour only, logical
 * properties only, no copy of its own.
 *
 * See `README.md` in this directory for the per-group contract.
 */

// Layout
export { Container, Section, Stack, Cluster, Grid, Rule, PageHeader, SectionHeading, type Gap } from './layout';

// Typography
export { Eyebrow, Lede, Prose, Heading, Caption, Meta } from './typography';
export { Bidi, DateText, Code } from './bidi';

// Actions
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
export { SubmitButton } from './submit-button';
export { LinkPendingMark } from './link-pending';
export { Icon, iconNames, type IconName, type IconSize } from './icon';

// Data display
export { Panel, Card, CardBody, CardFooter, CardMedia, RuledList, RuledListItem } from './card';
export {
  Badge,
  StatusBadge,
  VerificationBadge,
  type BadgeTone,
  type ContentStatusValue,
  type VerificationStatus,
} from './badge';
export { DefinitionList, type DefinitionItem } from './definition-list';
export { Table, TableScroller, TimeCell, type Column } from './table';
export {
  Stat,
  MetricTile,
  StatGroup,
  canRenderStat,
  type StatPeriod,
  type StatVerification,
  type StatInput,
} from './stat';
export { Figure, NoImage, Avatar, LogoTile, initialsOf, type ImageSource } from './figure';

// Feedback & states
export { Notice, Alert, LiveRegion, type NoticeTone } from './notice';
export { EmptyState, ErrorState, UntranslatedNotice, SubmissionReceipt } from './feedback';
export {
  SkeletonBlock,
  SkeletonText,
  ListSkeleton,
  CardGridSkeleton,
  TableSkeleton,
  StatGroupSkeleton,
  FormSkeleton,
  PageHeaderSkeleton,
  ListPageSkeleton,
  DetailPageSkeleton,
  AdminPageSkeleton,
} from './skeleton';

// Forms
export {
  Field,
  Fieldset,
  Legend,
  FieldError,
  FieldHint,
  RequiredMark,
  FormStack,
  FieldRow,
  FormActions,
  describedBy,
  errorText,
} from './field';
export {
  Input,
  Textarea,
  Select,
  Checkbox,
  CheckboxGroup,
  RadioGroup,
  FileInput,
  Honeypot,
  type Option,
} from './inputs';

// Navigation
export { Breadcrumbs, toBreadcrumbList, type BreadcrumbItem } from './breadcrumbs';
export { Pagination } from './pagination';
export { paginationModel, paginationRels, type PaginationModel, type PaginationLink } from './pagination-model';
export { Tabs, type TabItem } from './tabs';
export { SkipLink } from './skip-link';
