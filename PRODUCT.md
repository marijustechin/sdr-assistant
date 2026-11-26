# SDR Assistant — Market Research

## Purpose

For one product and one target country, SDR Assistant answers two questions:

- **A. Who already sells the exact product in that country, and at what price, if published?**
- **B. Who already sells products in the same category in that country?**

Both are successful research findings. A finding must identify the seller and link to public evidence of its own commercial offer in the target market. A catalogue entry, an offer to supply on request, or an invitation to request a quotation can establish that a product is offered for sale. A public price or completed transaction is optional.

Searching for companies that might buy or sell the product in the future is outside the scope of this research.

## One study

The user supplies a product name and description in English and selects one target country. Each study uses one research language determined for that country. The same product in a second country is a separate study.

Use the name and description to establish the product's defining characteristics. Use commercial terminology from the target market to identify the category sellers use and distinguish it from adjacent categories. Establish this definition once per study and use it consistently for search, assessment and reporting. A synonym can describe the same product. A shared material, application or customer segment alone does not establish category membership.

A new product or country must be researchable without a code change. The user does not have to select a predefined category or supply a list of traits. Research decisions must generalize across products, sellers, domains and markets. Fixtures and named examples belong in tests.

## Assess each offer

Record two separate decisions for each offer. One identifies **what the seller offers**. The other establishes **where the seller markets it**.

### Product match

| Verdict | Required evidence |
| --- | --- |
| `a` | The seller offers an item in the study category, and the evidence confirms all defining characteristics of the exact product for that same item. |
| `b` | The seller demonstrably offers an item in the study category. At least one exact-product characteristic differs or remains unconfirmed. |
| `none` | The evidence establishes neither match. Examples include a navigation label, editorial coverage, a third-party listing and an offer for an adjacent product. |

Attribute the offer to the business making it. A directory or marketplace hosting another company's description is not the seller. The named business can qualify through evidence of its own offer. On a page with several items, keep the description, characteristics and price tied to the relevant item.

### Target market

The market question is whether the seller **already offers the product or category to buyers in the selected country**. A foreign company can qualify. The following evidence can establish local trade:

- The seller publishes a product listing or catalogue aimed at that market. Assess the language of the actual offer. A translated menu alone is insufficient. Where several countries share the language, use country-specific commercial context to identify the intended market.
- The seller identifies a shop, showroom, sales branch or collection point in that country where the relevant goods can be ordered or obtained.
- The seller explicitly states that it sells the relevant goods in that country. If it names a local distributor, verify which business makes the offer and attribute the finding accordingly.

A registration address, phone prefix, VAT number, currency or domain suffix can help identify the business. None alone establishes a local commercial offer. A shipping destination, regional delivery promise or worldwide shipping policy establishes logistics only. A local seller's catalogue can qualify even when it gives no delivery information.

| Market status | Meaning for this offer |
| --- | --- |
| `target` | A quoted source establishes that the seller offers the relevant goods in the target market. |
| `unclear` | The available sources leave local trade unconfirmed. This includes a foreign listing supported only by shipping coverage. |
| `other` | The evidence explicitly places sales of this offer exclusively outside the target market or excludes that market from sales. A restriction on one delivery method alone is insufficient. |

The confirmed seller list includes companies with at least one `a + target` or `b + target` offer. Apply general market statements only to offers they cover. A product-specific exception takes precedence for that product.

## Results and evidence

Return one persisted study result through the research API. Preserve all company profiles, including incomplete, rejected and failed profiles. Temporary files are for testing and diagnostics. Each profile records the company name when known, domain, status, verified public contacts, assessed offers and their sources.

- Preserve the assessment ID and verdict of every offer passed to company profiling. Keep market evidence attributable to the offer it supports.
- Support product and market findings with a verbatim quote and source URL. For contacts, retain the published value as evidence and the URL where it appears. Leave missing facts unknown.
- For an exact-product price, retain the amount, currency, published unit, applicable variant and qualifiers such as “from” when available. Keep the price quote and URL. An undisclosed price leaves the product verdict intact.
- Count each identified seller once in the seller total. Report sellers with an exact match and sellers with category matches only. Preserve the underlying offer records and source URLs, including translated or duplicate listings, without counting those pages as additional sellers.

### Company profile status

| Status | Meaning |
| --- | --- |
| `profiled` | The company is named and has at least one confirmed target-market offer. |
| `needs_review` | Identification or market evidence is incomplete. A missing company name may require review even when an offer already has confirmed market evidence. |
| `rejected` | The profile has assessed offers and the evidence places all of them outside the target market. Missing evidence alone leads to review. |
| `error` | A technical failure prevents completion. Retain the profile and its input offer IDs. |

Report company profile status separately from offer verdict and market status. This lets the user see both how many sellers the study found and which profiles still need work.

## Autonomous product direction

The owner has approved an autonomous SDR Assistant product model. This section records the
product direction; Stage 05 and the communication stages are planned, not implemented.

### Autonomous workflow

The human supplies only:

- product name;
- product description;
- target country.

The assistant then runs, without per-company human intervention:

1. 01 — Product Identification.
2. 02 — Page Collection.
3. 03 — Page Assessment.
4. 04 — Company Profiling.
5. 05 — Lead Qualification and Contact Discovery. **Planned, not implemented.**

After the research is complete, the human configures the email account, the initial email subject
and message, and the communication schedule. The assistant then builds the eligible recipient
queue, sends individual messages according to the configured schedule, persists outgoing
communication outcomes, synchronizes the mailbox once or twice per day, associates incoming
replies with the relevant communication records, and updates communication history and
statistics.

### No mandatory manual review

The product must scale to thousands of discovered companies without a manual per-company review
step. Stage 05 must not produce a terminal `NEEDS_REVIEW` queue that requires human action.
Uncertain cases must be resolved automatically through bounded additional discovery, or excluded
from the current communication queue. Conceptual terminal outcomes are:

- `qualified`;
- `no_contact`;
- `insufficient_evidence`;
- `rejected`;
- `duplicate`;
- `processing_failed`.

These are product states; the exact implementation contract belongs to SDR-007A.

Historical Stage 04 company profile statuses remain unchanged. Stage 05 results and decisions must
be stored separately from the original Stage 01–04 research results. Rejected companies remain
available for historical inspection and market intelligence.

### Initial message and recipient eligibility

The initial email is authored by the owner and shared by all eligible recipients. AI
personalization is deferred. Recipient eligibility must account for applicable outreach
restrictions, suppression lists, opt-outs, invalid addresses and duplicate prevention. A publicly
discovered email address is not, by itself, permission to send marketing messages.

### Core product principle

**“Human configuration, machine execution.”** The human manages the process and observes its
outcomes rather than performing the assistant's work.

### Planned sequence

- SDR-007 — Research Results Presentation and Market.
- SDR-007A — Automatic Lead Qualification and Contact Discovery.
- SDR-008 — Email Account Assignment.
- SDR-009 — Initial Email and Automatic Recipient Queue.
- SDR-010 — Scheduled Email Sending and Communication History.
- SDR-011 — Automatic Mailbox Synchronization.
- SDR-012 — AI-Assisted Reply Management, deferred.

## Acceptance criteria

The following cases must hold for a previously unseen product and country without adding a category map, a hardcoded trait or a seller-specific exception.

| Given | Expected result |
| --- | --- |
| A seller's own catalogue for the target market offers the exact product on quotation, with no public price or delivery page. | `a + target`. Keep the seller and leave the price unknown. |
| The same kind of catalogue offers a category item with a different defining characteristic. | `b + target`. Include the category seller. |
| A foreign storefront offers the exact product and advertises international shipping. Its only connection to the target country is delivery coverage. | The product can be `a`. The market is `unclear`. Exclude it from the confirmed seller list. |
| A third-party portal publishes a seller's offer in the research language. | The portal does not qualify as the seller. |
| The same seller lists the same item at several URLs or in several languages. | Count one seller and retain the source URLs. |
| A completed study contains profiles with different statuses. | The API returns every persisted profile and its traceable offers, even after temporary files are removed. |
