/**
 * Study definition for stage 03: what belongs to the category and which traits
 * the exact product must confirm.
 *
 * TEMPORARY (stage 03 development): the two definitions were fixed before the
 * first v2 run so the run can be judged against gold labels. They belong to the
 * run input, not to the module: the category boundary and the required traits
 * are the client's decision, not a property of the product. When the pipeline
 * matures this file moves into the research request.
 */
export type PageAssessmentSpec = {
  /** One sentence: what belongs to the category, and what is outside it. */
  category: string;
  /** Traits the exact product must confirm, in reporting order. */
  traits: readonly PageAssessmentTrait[];
};

export type PageAssessmentTrait = {
  /** Name the model must use as the key of its answer. */
  name: string;
  /** What confirms this trait; a confirmed synonym is acceptable. */
  expected: string;
};

const STUDY_SPECS: Readonly<Record<string, PageAssessmentSpec>> = {
  Dailylentės: {
    category:
      'Wooden cladding boards for interior or exterior use. Decorative wall ' +
      'panels, bench boards, bench blanks, furniture, and metal or plastic ' +
      'cladding are outside this category.',
    traits: [
      {
        name: 'material',
        expected:
          'abachi; ayous is a confirmed trade name for the same wood',
      },
      {
        name: 'treatment',
        expected: 'thermally modified (termo)',
      },
    ],
  },
  'Dėvėti drabužiai': {
    category:
      'Used clothing sold in bulk to professional buyers. New clothing, retail ' +
      'fashion and single items are outside this category.',
    traits: [
      {
        name: 'sorting',
        expected: 'unsorted (mixed, not preselected by type or quality)',
      },
    ],
  },
};

/**
 * The study definition for one run. Keyed by the broadest category name stage
 * 01 returned, so the same product always gets the same boundary. A missing
 * entry fails the run before the first paid call instead of assessing pages
 * against nothing.
 */
export function resolveStudySpec(generalCategoryName: string): PageAssessmentSpec {
  const spec = STUDY_SPECS[generalCategoryName];

  if (!spec) {
    throw new Error(
      `No page-assessment spec for category "${generalCategoryName}". ` +
        'Add the category boundary and the required traits before running stage 03.',
    );
  }

  return spec;
}
