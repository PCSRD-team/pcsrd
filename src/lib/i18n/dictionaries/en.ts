import type { Dictionary } from './ar';

/**
 * English dictionary.
 *
 * Typed as `Dictionary`, so a key added to the Arabic file and forgotten here
 * fails the build. That is the point: a missing key would otherwise render as
 * `undefined` on a live page, and nobody reviewing an Arabic-first site checks
 * every English string.
 */
import { partialsEn } from './partials';

export const en: Dictionary = {
  ...partialsEn,
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
    language: 'Language',
    switchToEnglish: 'العربية',
    listSeparator: ', ',
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
    anonymousNotice:
      'You may submit this complaint without giving your name. We do not record your device address or browser details with complaints.',
    channel: 'Channel',
    identifier: 'Handle or number',
    evidenceUrl: 'Evidence link',
    occurredOn: 'Date it happened',
  },

  contactPage: {
    eyebrow: 'We are here to listen',
    lead: 'Send your enquiry and our team will follow up using the contact details you provide.',
    formTitle: 'Send us a message',
    formLead: 'Fields marked with an asterisk are required. We use your details only to respond to this request.',
    detailsTitle: 'Contact details',
    detailsLead: 'Reach us directly or verify the organisation’s official accounts.',
    responseNote: 'Your message goes directly to the organisation’s team, and you receive a reference number for follow-up.',
    officialChannels: 'Our official accounts',
    noContactDetails: 'Contact details will appear here once they are added in the dashboard.',
    verifyChannels: 'Verify all channels',
    complaintsEyebrow: 'A safe, independent channel',
    complaintsLead: 'You can submit a complaint confidentially without providing your name or contact details.',
    complaintFormTitle: 'Complaint details',
  },

  states: {
    emptyTitle: 'Nothing here yet',
    emptyBody: 'Content will appear here once it is published.',
    emptyFiltered: 'No results match these filters.',
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

    project: {
      dateOrder: 'The project start date must come before its end date.',
    },

    post: {
      expiryOnlyAnnouncements: 'An expiry date is only available on announcements.',
    },

    partner: {
      membershipLevelShape: 'A membership level applies to networks and memberships only.',
    },

    attachment: {
      sensitiveRefused: 'An attachment on a confidential report cannot be downloaded.',
    },

    users: {
      selfRole: 'You cannot change your own role. Ask another administrator.',
      selfDeactivate: 'You cannot deactivate your own account.',
      lastAdmin: 'The last active administrator cannot be removed.',
      inviteFailed: 'The invitation could not be sent. Check the email address and try again.',
      emailTaken: 'An account with this email address already exists.',
      profileMissing: 'The account was created but its profile was not found. Contact an administrator.',
    },

    redirects: {
      sourceTaken: 'A redirect from this path already exists.',
      pathFormat: 'The path must start with "/" and contain no spaces.',
      loop: 'Source and destination are the same.',
      reserved: 'Admin and API paths cannot be redirected.',
    },

    mediaInUse: 'A media asset that is in use cannot be deleted. Remove its usages first.',
  },

  admin: {
    saved: 'Saved.',
    created: 'Created.',
    statusChanged: 'Status changed.',
    deleted: 'Deleted.',
    invited: 'Invitation sent by email.',
    updated: 'Updated.',

    form: {
      checkFields: 'Check the highlighted fields.',
      save: 'Save',
      saveDraft: 'Save as draft',
      submitReview: 'Submit for review',
      publish: 'Publish',
      unpublish: 'Unpublish',
      archive: 'Archive',
      restore: 'Back to draft',
      delete: 'Delete',
      confirmDelete: 'Confirm deletion',
      deleteHint: 'Deletion is permanent and cannot be undone.',
      deletePublishedHint: 'Unpublish the item before deleting it.',
      actions: 'Actions',
      add: 'Add',
      back: 'Back to the list',
      lastEdited: 'Last edited',
    },

    flash: {
      error: 'The action could not be completed.',
    },

    users: {
      title: 'Users',
      description:
        'Access to confidential complaints is granted per person; the admin role does not grant it automatically.',
      invite: 'Invite a user',
      inviteHint:
        'The invitee receives an email to set a password. The account starts as an editor unless set otherwise.',
      email: 'Email',
      fullName: 'Full name',
      role: 'Role',
      sendInvite: 'Send invitation',
      setRole: 'Change role',
      grantSensitive: 'Grant confidential-complaint access',
      revokeSensitive: 'Revoke confidential-complaint access',
      deactivate: 'Deactivate account',
      reactivate: 'Reactivate account',
      confirmDeactivate: 'Confirm deactivation',
      you: 'you',
      selfHint: 'You cannot change your own role or deactivate yourself.',
      roles: { admin: 'Administrator', content_manager: 'Content manager', editor: 'Editor' },
      active: 'Active',
      inactive: 'Deactivated',
      sensitiveAllowed: 'Allowed',
      lastLogin: 'Last sign-in',
      never: 'Never signed in',
    },

    redirects: {
      title: 'Redirects',
      description:
        'Take effect immediately: the proxy consults a cached list that every save refreshes.',
      add: 'Add redirect',
      source: 'From path',
      sourceHint: 'The old path as it appears in the URL, e.g. /old-page. Matched with or without the locale prefix.',
      destination: 'To path',
      destinationHint: 'An internal path starting with / or a full URL starting with https://.',
      code: 'Status code',
      codes: {
        '301': '301 — permanent',
        '302': '302 — temporary',
        '307': '307 — temporary (keeps method)',
        '308': '308 — permanent (keeps method)',
      },
      empty: 'No redirects.',
    },

    media: {
      edit: 'Edit media details',
      usage: 'Where it is used',
      notUsed: 'Not used by any content.',
      usageHint: 'An asset cannot be deleted while it is in use. Remove its usages first.',
      delete: 'Delete asset',
      deleteHint: 'Removes the record and the file from storage.',
      file: 'File',
      dimensions: 'Dimensions',
      size: 'Size',
      uploaded: 'Uploaded',
      exifNotStripped: 'EXIF data not stripped',
      openDetail: 'Details',
      consent: {
        not_required: 'Not required',
        obtained: 'Documented',
        pending: 'Pending',
      },
      usageEntity: {
        program: 'Programme',
        project: 'Project',
        story: 'Story',
        post: 'News item',
        vacancy: 'Vacancy',
        page: 'Page',
        partner: 'Partner',
        person: 'Person',
        publication: 'Publication',
        organization: 'Organisation settings',
        project_gallery: 'Project gallery',
        story_gallery: 'Story gallery',
        program_gallery: 'Programme gallery',
        post_gallery: 'News gallery',
      },
    },

    submissions: {
      handling: 'Handling',
      state: 'State',
      internalNote: 'Internal note',
      noteHint: 'This note is not copied into the audit log.',
      handledBy: 'Handled by',
      handledAt: 'Last handled',
      notHandled: 'Not handled yet',
      download: 'Download attachment',
      downloadHint: 'Every download is written to the audit log.',
      sensitiveNoDownload: 'Attachments on confidential complaints cannot be downloaded.',
      purgeAt: 'Automatically deleted on',
      field: 'Field',
      value: 'Value',
      empty: 'No content.',
      states: {
        new: 'New',
        in_progress: 'In progress',
        handled: 'Handled',
        archived: 'Archived',
      },
    },
  },

  footer: {
    identityTitle: 'Identity record',
    channelsTitle: 'Official channels',
    programsTitle: 'Programmes',
    brandTitle: 'Organization',
    quickLinksTitle: 'Quick links',
    getInvolvedTitle: 'Get involved',
    contactTitle: 'Contact and social',
    secondaryEmail: 'Secondary email',
    noSocialLinks: 'Social accounts will appear here once their URLs are configured.',
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

  seo: {
    ogImageAlt: 'Organisation card with its name and short description',
    getInvolved: {
      volunteerTitle: 'Volunteer with us',
    },
  },

  a11y: {
    mainNav: 'Main navigation',
    breadcrumb: 'Breadcrumb',
    pagination: 'Pagination',
    filterPanel: 'Filter panel',
  },
};
