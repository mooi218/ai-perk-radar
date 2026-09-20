# Catalog expansion for 0.1.8

This is a data-only, schema-1 expansion prepared on 2026-09-20. The working catalog advances from revision `2026-09-20.1` to `2026-09-20.2`; its release timestamp is `2026-09-20T07:46:56Z`. This document records the source review, not a claim that the data has already been published to production.

## Scope and compatibility

- 45 existing records are preserved, including their IDs, source URLs, conditions, translations, and original review dates.
- 55 new records bring the total to 100: 35 student offers, 15 ordinary free tiers, 4 limited trials, and 1 academic-research program.
- Of the additions, 53 are `active` and 2 are `check`. New Relic and ToDiagram require the follow-up described below and must not be represented as unconditionally available.
- Every new record has English content, Japanese value/reason/caution text, and an official source. Only the new records receive `verified_at` and `last_checked` of `2026-09-20`.
- Schema and field names are unchanged for the published 0.1.7 matcher. All student-pack children retain the existing `github-student-developer-pack` parent.
- `GLOBAL` is the schema's broad discovery grouping. It is not evidence of eligibility in every country. Each new record explicitly asks users to check the provider's region and account conditions; each student-pack entry explicitly requires verified GitHub student status. No new text asserts worldwide eligibility from silence.
- A null `deadline` means no fixed enrollment closing date was established in the reviewed offer, not unlimited use. Thirty-day, ninety-day, six-month, and one-year benefit durations are recorded in the offer text. Relative expiry cannot be calculated without the user's actual redemption date.
- No student discount is split into multiple records for the same entitlement. For example, GitLens is not added separately from the existing GitKraken student plan. Distinct free services and eligible new-account trials have their own terms and are not represented as additive cash value.

## Review method and limits

The review used official provider pages, documentation, and the [GitHub Education all-offers catalog](https://education.github.com/pack/). Provider redemption instructions took precedence where they clarified marketing summaries. The [GitHub student eligibility documentation](https://docs.github.com/en/education/about-github-education/github-education-for-students/apply-to-github-education-as-a-student) was reviewed for the common verification prerequisite.

The access date means the official source text was reviewed on that date. No offer was redeemed, no account was created, no payment method was added, and remaining capacity or individual eligibility was not tested. Search-index and documentation caches can lag the live enrollment flow. Country coverage is not encoded exhaustively by the current three-value region schema. A provider can still refuse enrollment under its own age, account, institution, regional, or usage rules.

## Added records and primary evidence

The source links below are also the catalog's auditable source URLs. Additional sources needed for particular limits are listed after the table.

| New ID | Official source | Recorded benefit | Status |
| --- | --- | --- | --- |
| `github-pack-namecom` | [Name.com](https://www.name.com/support/articles/360036364834-signing-up-for-github-student-developer-pack) | 対象ドメイン1件とDomain Safeを初年度無料 | active |
| `github-pack-tech-domain` | [.TECH](https://get.tech/github-student-developer-pack) | 標準.techドメイン1件を1年間 | active |
| `github-pack-1password` | [1Password](https://1password.com/developers/students) | 個人プランと開発者ツールを1年間 | active |
| `github-pack-deepnote` | [Deepnote](https://deepnote.com/docs/edu-verification) | データ分析用のEducationワークスペース | active |
| `github-pack-polypane` | [Polypane](https://polypane.app/github-students/) | 非商用のWeb開発向けに1年間無料 | active |
| `github-pack-requestly` | [Requestly](https://requestly.com/github-education/) | Professionalを1年間無料 | active |
| `github-pack-doppler` | [Doppler](https://support.doppler.com/hc/en-us/articles/12778257327387-SecretOps-for-Students-Program-not-applying-discount) | 学生向けTeamプラン | active |
| `github-pack-poeditor` | [POEditor](https://poeditor.com/kb/free-software-localization) | Plusを1年間・最大10,000文字列 | active |
| `github-pack-devcycle` | [DevCycle](https://www.devcycle.com/github-education) | 機能フラグ管理のStarterを1年間 | active |
| `github-pack-codescene` | [CodeScene](https://codescene.com/resources/github-students) | 非公開GitHubプロジェクトのコード分析 | active |
| `github-pack-working-copy` | [Working Copy](https://workingcopy.app/education/) | iPhone・iPadでPro機能を利用 | active |
| `github-pack-tower` | [Tower](https://www.git-tower.com/students) | Proを12か月・在籍再確認で延長可能 | active |
| `github-pack-vaadin` | [Vaadin](https://vaadin.com/education) | 教育向けProコンポーネント・ツール | active |
| `github-pack-xojo` | [Xojo](https://www.xojo.com/githubstudent/) | Proライセンスと1年間の更新 | active |
| `github-pack-configcat` | [ConfigCat](https://configcat.com/student/) | 機能フラグ1,000件・共同利用者数無制限 | active |
| `github-pack-blackfire` | [Blackfire](https://www.blackfire.io/students/) | アプリ性能を調べるProfilerプラン | active |
| `github-pack-camber` | [Camber](https://education.github.com/pack/) | 月40 CPU時間・5 GPU時間 | active |
| `github-pack-zyte` | [Zyte](https://www.zyte.com/scrapy-cloud-student-backpack/) | Scrapy Cloud 1ユニット・データ保持120日 | active |
| `github-pack-codecov` | [Codecov](https://about.codecov.io/for/education/) | 学生プロジェクトのテスト網羅率を分析 | active |
| `github-pack-pageclip` | [Pageclip](https://pageclip.co/github-students) | Basicプラン・送信20,000件の枠 | active |
| `github-pack-sqlgate` | [SQLGate](https://www.sqlgate.com/student-pack) | Standardの主要機能を1年間 | active |
| `github-pack-dashlane` | [Dashlane](https://www.dashlane.com/github-students) | 新規アカウントでPremiumを6か月 | active |
| `github-pack-appfigures` | [Appfigures](https://appfigures.com/landing/github-student) | アプリ分析・ストア最適化ツールを1年間 | active |
| `github-pack-themeisle` | [Themeisle](https://themeisle.com/github-students/) | Neve Agency・1年間の更新とサポート | active |
| `github-pack-localstack` | [LocalStack](https://www.localstack.cloud/localstack-for-students) | AWSエミュレーターと月1,000 CI/CDクレジット | active |
| `github-pack-arduino` | [Arduino](https://www.arduino.cc/education/github-students) | Arduino Cloud Makerを6か月 | active |
| `github-pack-newrelic` | [New Relic](https://docs.newrelic.com/docs/accounts/accounts-billing/account-setup/student-program/) | 月500GBのデータ・3名のフル機能ユーザー | check |
| `github-pack-icons8` | [Icons8](https://icons8.com/github-students) | アイコン・イラスト・写真・音楽を3か月 | active |
| `github-pack-iconscout` | [IconScout](https://help.iconscout.com/how-can-i-get-a-student-plan) | 対象プレミアムアイコンを月60点・1年間 | active |
| `github-pack-todiagram` | [ToDiagram](https://todiagram.com/docs/github-student-developer-pack) | エディターを12か月・保存上限は要確認 | check |
| `github-pack-carto` | [CARTO](https://docs.carto.com/faqs/carto-for-education) | 地図・空間データ分析の学生アカウント | active |
| `github-pack-testmail` | [Testmail](https://education.github.com/pack/) | 学生向けEssentialプラン | active |
| `github-pack-scrimba` | [Scrimba](https://education.github.com/pack/) | Proコース・演習を1か月 | active |
| `github-pack-browserstack` | [BrowserStack](https://www.browserstack.com/github-students) | Automate Mobile・1名1並列を1年間 | active |
| `github-pack-adafruit` | [Adafruit](https://www.adafruit.com/github-students) | Adafruit IO+を1年間 | active |
| `gemini-api-free` | [Google](https://ai.google.dev/gemini-api/docs/pricing) | 対象モデルの入出力トークンが無料 | active |
| `cerebras-inference-trial` | [Cerebras](https://inference-docs.cerebras.ai/support/rate-limits) | 新規登録で5米ドル・有効30日 | active |
| `openrouter-free-models` | [OpenRouter](https://openrouter.ai/docs/api_reference/limits) | 無料モデルのAPIを上限内で利用 | active |
| `pinecone-starter` | [Pinecone](https://www.pinecone.io/pricing/) | ベクトルDB 2GB・最大5インデックス | active |
| `turso-free` | [Turso](https://turso.tech/pricing) | 100データベース・合計5GB | active |
| `upstash-vector-free` | [Upstash](https://upstash.com/pricing/vector) | 無料DB 1件・検索と更新を1日計10,000回 | active |
| `github-pages-free` | [GitHub](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) | 公開リポジトリから静的サイトを公開 | active |
| `cloudflare-r2-free` | [Cloudflare](https://developers.cloudflare.com/r2/pricing/) | 月10GB月・操作回数の無料枠 | active |
| `cloudflare-d1-free` | [Cloudflare](https://developers.cloudflare.com/d1/platform/pricing/) | SQL保存5GB・1日500万行読込み／10万行書込み | active |
| `algolia-free` | [Algolia](https://www.algolia.com/pricing) | 月10,000検索・50,000レコード | active |
| `aiven-postgresql-free` | [Aiven](https://aiven.io/free-postgresql-database) | 保存1GB・RAM 1GB・CPU 1基 | active |
| `elevenlabs-free` | [ElevenLabs](https://elevenlabs.io/text-to-speech) | 音声生成を月10,000クレジット | active |
| `postman-free` | [Postman](https://www.postman.com/pricing/) | 個人向けAPIクライアント・テスト機能 | active |
| `sentry-developer-free` | [Sentry](https://sentry.io/pricing/) | 1ユーザー・エラー5,000件の枠 | active |
| `linear-free` | [Linear](https://linear.app/pricing) | 2チーム・250課題・メンバー数無制限 | active |
| `google-cloud-trial` | [Google Cloud](https://docs.cloud.google.com/free/docs/free-cloud-features) | 対象の新規利用者に300米ドル・90日間 | active |
| `aws-free-plan` | [Amazon Web Services](https://aws.amazon.com/free/) | 最初に100米ドル・条件達成で最大200米ドル | active |
| `azure-free-account` | [Microsoft](https://azure.microsoft.com/en-us/pricing/purchase-options/azure-account) | 新規利用者に200米ドル・30日間 | active |
| `wandb-academic` | [Weights & Biases](https://site.wandb.ai/pricing/) | 研究向けPro・クラウド保存200GB | active |
| `mistral-api-free` | [Mistral AI](https://help.mistral.ai/en/articles/698531-why-am-i-hitting-api-rate-limits-and-how-do-i-increase-them) | 開発者向けAPIを評価・試作用の枠内で利用 | active |

## Material qualifications and reconciled sources

- **New Relic:** [current enrollment documentation](https://docs.newrelic.com/docs/accounts/accounts-billing/account-setup/student-program/) states that self-service enrollment is unavailable and a support case is required. The [student page](https://newrelic.com/students) advertises 500 GB/month and three full-platform users. The offer is `check`, with support provisioning disclosed.
- **ToDiagram:** the [redemption guide](https://todiagram.com/docs/github-student-developer-pack) and GitHub listing say ten cloud documents, but the [education landing page](https://todiagram.com/education) says two hundred. The record is `check` and deliberately does not promise either storage allowance. The guide establishes twelve months, no card required, no AI features, and waiting for an existing paid subscription to end.
- **GoRails was not added:** its [student signup page](https://gorails.com/github-students) currently says three months in its heading and FAQ but twelve months in the body; GitHub also lists twelve. A maintainer should resolve the duration before publishing a precise entitlement.
- **Cerebras:** [current rate-limit FAQ](https://inference-docs.cerebras.ai/support/rate-limits) describes a payment-verified, USD 5/30-day trial and explicitly says there is no permanent free tier. It is classified as `other`, not `free_tier`.
- **Google Cloud:** [trial terms](https://docs.cloud.google.com/free/docs/free-cloud-features) exclude prior paying Google Cloud, Maps Platform, or Firebase customers and prior trial users. The trial has payment verification and restrictions on VM GPUs, AI Studio Gemini API charges, and managed partner-model APIs. The record is not a GPU credit guarantee. The [Gemini availability page](https://ai.google.dev/gemini-api/docs/available-regions) separately confirms Japan and the 18+ requirement for the Gemini API offer.
- **Doppler:** the [activation support article](https://support.doppler.com/hc/en-us/articles/12778257327387-SecretOps-for-Students-Program-not-applying-discount) requires GitHub sign-in and a new workplace. The Team/active-student entitlement is corroborated by GitHub's current listing. The record tells the user to confirm the discount before using paid features.
- **POEditor:** the [education article](https://poeditor.com/blog/translation-localization-educational-projects/) supplies the 10,000-string allowance; the current [knowledge base](https://poeditor.com/kb/free-software-localization) confirms the one-year student Plus plan. Its unrelated six-month alternative education offer is not combined with this entitlement.
- **Camber:** the [provider's student page](https://www.cambercloud.com/github-student-pack) confirms the dedicated free student plan. GitHub supplies its current CPU/GPU/storage/message allowances; no reserved GPU availability is implied.
- **CodeScene, Codecov and BrowserStack:** GitHub clarifies private-repository eligibility or the one-user/one-parallel BrowserStack allowance; the linked provider pages confirm the education programs. We do not infer entitlement to all products from broad suite marketing.
- **SQLGate:** the [student-license conditions](https://www.sqlgate.com/pricing/education) restrict use to education and exclude technical support/offline activation. Its separate direct-license renewal program is not promised for the GitHub redemption.
- **Dashlane:** the [GitHub offer](https://www.dashlane.com/github-students) is six months for new accounts. The [student-trial help page](https://support.dashlane.com/hc/en-us/articles/202665962-Free-trials-and-discounts-on-Dashlane-plans) describes a different one-year university-email route and excludes VPN access. The two routes are not combined or counted twice.
- **Themeisle:** the [offer page](https://themeisle.com/github-students/) confirms the theme license, one year of updates/support, and unlimited sites. [Billing guidance](https://docs.themeisle.com/billing/unrecognized-or-unexpected-charges) explicitly requires a payment method and automatic renewal at standard prices after a student promotion. Both languages disclose the payment requirement and cancellation needed to avoid renewal.
- **Cloudflare R2:** [setup documentation](https://developers.cloudflare.com/r2/get-started/) requires the subscription checkout flow. Standard-storage allowances do not cover Infrequent Access; overage and connected-service charges remain possible.
- **Upstash Vector:** adding a card upgrades the index to pay-as-you-go according to the pricing FAQ. Its free database is a different service from the existing Redis entry.
- **1Password, Polypane, Requestly, Xojo, ElevenLabs and W&B:** the records preserve respectively the Individual/one-time limitation, non-commercial-only use, one-time Individual offer, one-year update entitlement, non-commercial/attribution terms, and institutional/non-profit-connected research requirement.

## Validation

Executed `py -3 scripts/check_catalog.py`: revision `2026-09-20.2`, 100 valid records. The file is 157,526 bytes, below the current 256 KiB limit and the 250-record maximum. A semantic comparison against commit `8b0fe3e` found no changes to the original 45 records. All 100 records have Japanese reason text. The schema validator also checks stable/unique IDs, valid parents, HTTPS sources, allowed values, chronology, encoding, and bounded text.

Publication, authenticated redemption, and live provider-account checks have not been performed. The application workstream separately verifies matching, source discovery, and user-visible rendering.
