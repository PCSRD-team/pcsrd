import type { Dictionary } from './ar';

/**
 * English dictionary.
 *
 * Typed as `Dictionary`, so a key added to the Arabic file and forgotten here
 * fails the build. That is the point: a missing key would otherwise render as
 * `undefined` on a live page, and nobody reviewing an Arabic-first site checks
 * every English string.
 */
export const en: Dictionary = {
  common: {
    skipToContent: 'Skip to content',
    menu: 'Menu',
    close: 'Close',
    search: 'Search',
    readMore: 'Read more',
    viewAll: 'View all',
    back: 'Back',
    next: 'Next',
    previous: 'Previous',
    page: 'Page',
    of: 'of',
    loading: 'Loading…',
    required: 'Required',
    optional: 'Optional',
    submit: 'Send',
    submitting: 'Sending…',
    download: 'Download',
    externalLink: 'External link',
    language: 'Language',
    switchToEnglish: 'العربية',
  },

  nav: {
    home: 'Home',
    about: 'About',
    programs: 'Programmes',
    projects: 'Projects',
    impact: 'Impact',
    news: 'News',
    partners: 'Partners',
    resources: 'Publications',
    careers: 'Careers',
    contact: 'Contact',
    verify: 'Verify our channels',
    support: 'Support us',
    partner: 'Partner with us',
  },

  channels: {
    barLabel: 'Official channels',
    barText: 'Make sure you are dealing with our official accounts',
    barCta: 'See the verified list',
  },

  home: {
    heroEyebrow: 'Registered civil society organisation',
    programsTitle: 'Our programmes',
    programsLead: 'Three programmes, delivered through projects documented with their periods and outcomes.',
    impactTitle: 'Impact',
    impactLead: 'Every published figure carries its period and verification status.',
    latestTitle: 'Latest',
    storiesTitle: 'Stories from the field',
    partnersTitle: 'Our partners',
    verifyTitle: 'Our official channels',
    verifyLead: 'If a donation request reaches you in our name from a channel not listed here, it is not from us.',
  },

  programs: {
    title: 'Programmes',
    lead: 'What we work on, for whom, and how to reach the service.',
    eligibility: 'Who qualifies',
    howToAccess: 'How to access the service',
    objectives: 'Specific objectives',
    interventions: 'Key interventions',
    sustainability: 'Sustainability',
    targetGroups: 'Target groups',
    projectsInProgram: 'Projects in this programme',
    projectCount: 'Projects',
  },

  projects: {
    title: 'Projects',
    lead: 'The record of completed and ongoing projects.',
    filters: 'Filters',
    clearFilters: 'Clear filters',
    program: 'Programme',
    governorate: 'Governorate',
    theme: 'Theme',
    year: 'Year',
    state: 'Status',
    statePlanned: 'Planned',
    stateActive: 'Ongoing',
    stateCompleted: 'Completed',
    results: 'results',
    objective: 'Objective',
    activities: 'Activities',
    outcomes: 'Outcomes',
    period: 'Period',
    locations: 'Locations',
    implementingPartners: 'Implementing partners',
    donors: 'Donors',
    gallery: 'From the field',
  },

  impact: {
    title: 'Impact',
    lead: 'Figures shown with their period and verification source.',
    period: 'Period',
    verified: 'Verified',
    reported: 'Reported',
    target: 'Target',
    source: 'Verification source',
    storiesTitle: 'Stories',
    storyAnonymized: 'The subject of this story has been anonymised for their protection.',
  },

  news: {
    title: 'News',
    lead: 'News, statements and announcements.',
    categoryNews: 'News',
    categoryStatement: 'Statement',
    categoryAnnouncement: 'Announcement',
    publishedOn: 'Published',
  },

  careers: {
    title: 'Careers and volunteering',
    lead: 'Currently open positions.',
    deadline: 'Application deadline',
    location: 'Location',
    employmentType: 'Contract type',
    postedOn: 'Posted',
    requirements: 'Requirements',
    applyNow: 'Apply now',
    applyByEmail: 'Apply by email',
    closed: 'Applications are closed',
    noOpenings: 'There are no open positions at the moment.',
  },

  verify: {
    title: 'Our official channels',
    lead: 'These are the only channels we speak through.',
    channel: 'Channel',
    handle: 'Handle',
    lastVerified: 'Last verified',
    official: 'Official',
    notOurs: 'Not ours',
    reportTitle: 'Report an impersonation',
    reportLead: 'If you see an account or a number using our name, tell us.',
  },

  about: {
    title: 'About',
    identity: 'Identity record',
    legalName: 'Legal name',
    licenseNumber: 'Licence number',
    licenseAuthority: 'Licensing authority',
    foundedYear: 'Founded',
    legalForm: 'Legal form',
    vision: 'Vision',
    mission: 'Mission',
    values: 'Values',
    principles: 'Principles',
    strategy: 'Strategic plan',
    governance: 'Governance',
    board: 'Board',
    executive: 'Executive team',
    structure: 'Organisational structure',
    membership: 'Memberships and networks',
  },

  partners: {
    title: 'Partners',
    lead: 'The organisations we work with.',
    implementing: 'Implementing partner',
    donor: 'Donor',
    network: 'Network',
    membership: 'Membership',
    logoWithheld: 'Logo permission has not been granted yet.',
  },

  resources: {
    title: 'Publications',
    lead: 'Reports, policies and studies.',
    report: 'Report',
    policy: 'Policy',
    profile: 'Profile',
    strategy: 'Strategy',
    evaluation: 'Evaluation',
    other: 'Other',
    fileSize: 'File size',
    notAvailableInLocale: 'This publication is available in Arabic only.',
  },

  forms: {
    success: 'We have received your message.',
    successWithReference: 'We have received your message. Your reference number:',
    keepReference: 'Keep this number for any follow-up.',
    name: 'Name',
    email: 'Email',
    phone: 'Phone',
    subject: 'Subject',
    message: 'Message',
    organizationName: 'Organisation name',
    organizationType: 'Organisation type',
    country: 'Country',
    role: 'Role',
    interest: 'Area of interest',
    programsOfInterest: 'Relevant programmes',
    enquiryType: 'Enquiry type',
    ageBand: 'Age band',
    governorate: 'Governorate',
    areas: 'Volunteering areas',
    availability: 'Availability',
    experience: 'Previous experience',
    motivation: 'Why you want to volunteer',
    cv: 'CV',
    cvHint: 'PDF or Word, 4 MB maximum.',
    coverNote: 'Cover note',
    portfolioUrl: 'Portfolio link',
    category: 'Category',
    incidentDate: 'Date of incident',
    location: 'Location',
    description: 'Description',
    relatedProject: 'Related project',
    contactPreference: 'How you prefer to be contacted',
    contactNone: 'I do not want to be contacted',
    anonymousNotice:
      'You may submit this complaint without giving your name. We do not record your device address or browser details with complaints.',
    channel: 'Channel',
    identifier: 'Handle or number',
    evidenceUrl: 'Evidence link',
    occurredOn: 'Date it happened',
  },

  states: {
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Content will appear here once it is published.',
    emptyFiltered: 'No results match these filters.',
    errorTitle: 'This section could not be shown',
    errorBody: 'Something went wrong. Try refreshing the page.',
    retry: 'Try again',
    notFoundTitle: 'Page not found',
    notFoundBody: 'The link may be out of date, or the page may have been removed.',
    untranslatedTitle: 'This page has not been translated yet',
    untranslatedBody: 'The content is shown in Arabic.',
  },

  errors: {
    validation: 'Check the highlighted fields.',
    unexpected: 'Something went wrong.',
    rateLimited: 'Too many attempts. Please try again shortly.',
    captcha: 'We could not verify that you are not a robot. Please try again.',
    unauthorized: 'You need to sign in.',
    forbidden: 'You do not have permission for this action.',
    notFound: 'Not found.',
    field: {
      required: 'This field is required.',
      email: 'Enter a valid email address.',
      phone: 'Enter a valid phone number.',
      url: 'Enter a valid link.',
      date: 'Enter a valid date.',
      number: 'Enter a valid number.',
      country: 'Select a country.',
      slug: 'Only letters, numbers and hyphens are allowed.',
      uuid: 'Invalid identifier.',
      tooShort: 'This is shorter than allowed.',
      tooLong: 'This is longer than allowed.',
    },
    upload: {
      too_large: 'The file is larger than 4 MB.',
      bad_type: 'That file type is not supported.',
      empty: 'The file is empty.',
      unreadable: 'The file could not be read.',
      failed: 'The upload failed. Please try again.',
    },

    // Thrown by the service layer. These twelve keys were referenced in code
    // and defined in neither dictionary, and `resolveKey` returns the key
    // itself when it does not resolve — so an editor who tripped the
    // safeguarding gate saw the literal string `errors.media.minorConsentState`.
    invalidEmail: 'Enter a valid email address.',

    slug: {
      taken: 'That path is already in use. Choose another.',
    },

    content: {
      unpublishFirst: 'Unpublish this item before doing that.',
    },

    media: {
      altRequired: 'Arabic alt text is required for every asset.',
      minorConsentState:
        'A photograph showing an identifiable child cannot be stored as "consent not required".',
      minorConsentRequired:
        'Cannot publish: media showing identifiable children without documented consent.',
      consentReferenceRequired:
        'Enter the consent reference. Claiming consent without a document is not accepted.',
    },

    metric: {
      periodOrder: 'The period start must come before the period end.',
      sourceRequired: 'A source is required for this figure.',
      mustBeVerified: 'An impact figure cannot be published before it is verified.',
    },

    story: {
      consentRequired: 'A beneficiary story needs documented consent before publishing.',
    },

    attachment: {
      sensitiveRefused: 'An attachment on a confidential report cannot be downloaded.',
    },
  },

  footer: {
    identityTitle: 'Identity record',
    channelsTitle: 'Official channels',
    programsTitle: 'Programmes',
    legalTitle: 'Legal',
    privacy: 'Privacy policy',
    accessibility: 'Accessibility',
    terms: 'Terms of use',
    complaints: 'Complaints mechanism',
    rights: 'All rights reserved',
  },

  enums: {
    governorate: {
      north_gaza: 'North Gaza',
      gaza: 'Gaza',
      middle: 'Middle Area',
      khan_younis: 'Khan Younis',
      rafah: 'Rafah',
    },
    theme: {
      women: 'Women',
      children: 'Children',
      youth_adolescents: 'Youth and adolescents',
      psychosocial_health: 'Psychosocial health',
      relief: 'Relief',
    },
    program: {
      protection: 'Protection',
      humanitarian_response: 'Humanitarian response',
      early_recovery: 'Early recovery',
    },
    targetGroup: {
      children: 'Children',
      youth: 'Youth',
      women: 'Women',
      poor_families: 'Families living in poverty',
      elderly: 'Older people',
      pwd: 'People with disabilities',
    },
    partnerType: {
      implementing: 'Implementing partner',
      donor: 'Donor',
      network: 'Network',
      membership: 'Membership',
    },
    personCategory: {
      board: 'Board',
      executive: 'Executive team',
      staff: 'Staff',
    },
    publicationType: {
      report: 'Report',
      policy: 'Policy',
      profile: 'Profile',
      strategy: 'Strategy',
      evaluation: 'Evaluation',
      other: 'Other',
    },
  },

  formOptions: {
    un: 'United Nations', ingo: 'International NGO', foundation: 'Foundation',
    government: 'Government body', local_ngo: 'Local NGO',
    private: 'Private sector', other: 'Other',

    funding: 'Funding', consortium: 'Consortium', implementation: 'Implementation',
    technical: 'Technical support',

    general: 'General enquiry', partnership: 'Partnership', media: 'Media',
    complaint: 'Complaint',

    under_18: 'Under 18', '18_24': '18–24', '25_34': '25–34',
    '35_49': '35–49', '50_plus': '50 and over',

    psychosocial: 'Psychosocial support', education: 'Education',
    relief_distribution: 'Relief distribution', logistics: 'Logistics',
    administration: 'Administration',

    weekdays: 'Weekdays', weekends: 'Weekends',
    evenings: 'Evenings', flexible: 'Flexible',

    service_quality: 'Quality of service', staff_conduct: 'Conduct of a staff member',
    selection_process: 'Selection process', safeguarding: 'Safeguarding',
    corruption: 'Corruption or misuse',

    none: 'I do not want to be contacted', email: 'By email', phone: 'By phone',

    facebook: 'Facebook', instagram: 'Instagram', whatsapp: 'WhatsApp',
    telegram: 'Telegram', x: 'X', website: 'Website',
    phone_call: 'Phone call', sms: 'SMS', in_person: 'In person',
  },

  a11y: {
    mainNav: 'Main navigation',
    footerNav: 'Footer links',
    breadcrumb: 'Breadcrumb',
    pagination: 'Pagination',
    currentPage: 'Current page',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    filterPanel: 'Filter panel',
  },
};
