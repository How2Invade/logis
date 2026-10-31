// Claude-backed recall message drafting and call-feedback extraction for the Action module.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import type { CallFeedback, ContactRole, Language } from './store';

const MODEL = 'claude-opus-5-5';
// refusal fallback: the API re-runs a declined request on a suitable model automatically
const FALLBACK = { betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const };

export const LANGUAGES: Record<Language, string> = {
  en: 'English', hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali',
};
export const ROLE_LABEL: Record<ContactRole, string> = {
  warehouse_manager: 'Warehouse Manager', store_owner: 'Store Owner', store_staff: 'Store Staff',
  warehouse_worker: 'Warehouse Staff', distributor: 'Distributor',
};

export interface RecallContext {
  incidentId: string;
  title: string;
  description: string;
  defectType: string;
  severity: string;
  sourceLot: string;
  detectedAt: string;
  batches: Array<{ batchId: string; product: string; producedAt: string | null; quantity: number }>;
  affectedUnits: number;
  location?: { name: string; id: string; affectedUnits: number; uncertainUnits: number };
}

export interface DraftMessage {
  subject: string;
  body: string;
  source: 'ai' | 'template';
  note?: string;
}

export const aiConfigured = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

let client: Anthropic | null = null;
const anthropic = () => (client ??= new Anthropic());

const fmtDate = (s: string | null) => {
  if (!s) return 'not recorded';
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? s : d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

function facts(ctx: RecallContext): string {
  const lines = ctx.batches.slice(0, 8).map((b) => `- ${b.product} — batch ${b.batchId}, manufactured ${fmtDate(b.producedAt)}, ${b.quantity.toLocaleString('en-IN')} units produced`);
  return [
    `Incident: ${ctx.incidentId} — ${ctx.title}`,
    `Issue: ${ctx.description}`,
    `Defect type: ${ctx.defectType.replace(/_/g, ' ')}; severity: ${ctx.severity}`,
    `Source lot: ${ctx.sourceLot}; detected ${fmtDate(ctx.detectedAt)}`,
    `Affected batches:`,
    ...lines,
    ctx.batches.length > 8 ? `- plus ${ctx.batches.length - 8} more batches` : '',
    `Units confirmed affected across the network: ${ctx.affectedUnits.toLocaleString('en-IN')}`,
    ctx.location ? `This recipient's site: ${ctx.location.name} (${ctx.location.id}) — ${ctx.location.affectedUnits.toLocaleString('en-IN')} affected units, ${ctx.location.uncertainUnits.toLocaleString('en-IN')} needing verification` : '',
  ].filter(Boolean).join('\n');
}

const TEMPLATE: Record<'en' | 'hi' | 'mr', { subject: string; greet: (r: string) => string; intro: string; steps: string[]; dont: string; sign: string; labels: [string, string, string, string, string] }> = {
  en: {
    subject: 'URGENT — Product Recall Notice',
    greet: (r) => `Dear ${r},`,
    intro: 'A quality investigation has identified a defect in the following product batch(es) supplied to your location.',
    steps: ['Stop further distribution and sale immediately.', 'Quarantine all remaining stock of these batches.', 'Count the units still on hand and any already sold or dispatched.', 'Confirm receipt of this notice.'],
    dont: 'Please do not sell, distribute or use the affected products until LOGIS sends further instructions.',
    sign: 'LOGIS — Automated Recall Management',
    labels: ['Product', 'Batch', 'Manufactured', 'Issue', 'Units affected at your site'],
  },
  hi: {
    subject: 'अत्यावश्यक — उत्पाद रिकॉल सूचना',
    greet: (r) => `प्रिय ${r},`,
    intro: 'गुणवत्ता जाँच में आपके स्थान पर भेजे गए निम्नलिखित उत्पाद बैच में दोष पाया गया है।',
    steps: ['आगे का वितरण और बिक्री तुरंत रोकें।', 'इन बैचों का सारा बचा हुआ स्टॉक अलग (क्वारंटीन) करें।', 'हाथ में बचे और पहले से बिके/भेजे गए यूनिट गिनें।', 'इस सूचना की प्राप्ति की पुष्टि करें।'],
    dont: 'LOGIS के अगले निर्देश तक प्रभावित उत्पादों को न बेचें, न वितरित करें और न उपयोग करें।',
    sign: 'LOGIS — स्वचालित रिकॉल प्रबंधन',
    labels: ['उत्पाद', 'बैच', 'निर्माण तिथि', 'समस्या', 'आपके स्थान पर प्रभावित यूनिट'],
  },
  mr: {
    subject: 'तातडीचे — उत्पादन रिकॉल सूचना',
    greet: (r) => `प्रिय ${r},`,
    intro: 'गुणवत्ता तपासणीत तुमच्या ठिकाणी पाठवलेल्या खालील उत्पादन बॅचमध्ये दोष आढळला आहे.',
    steps: ['पुढील वितरण आणि विक्री त्वरित थांबवा.', 'या बॅचचा उरलेला सर्व साठा वेगळा (क्वारंटाईन) करा.', 'हातात असलेले आणि आधीच विकलेले/पाठवलेले युनिट मोजा.', 'ही सूचना मिळाल्याची पुष्टी करा.'],
    dont: 'LOGIS च्या पुढील सूचनांपर्यंत प्रभावित उत्पादने विकू नका, वितरित करू नका किंवा वापरू नका.',
    sign: 'LOGIS — स्वयंचलित रिकॉल व्यवस्थापन',
    labels: ['उत्पादन', 'बॅच', 'उत्पादन तारीख', 'समस्या', 'तुमच्या ठिकाणी प्रभावित युनिट'],
  },
};

export function templateMessage(ctx: RecallContext, role: ContactRole, language: Language): DraftMessage {
  const lang = language === 'hi' || language === 'mr' ? language : 'en';
  const t = TEMPLATE[lang];
  const [lp, lb, lm, li, lu] = t.labels;
  const batchLines = ctx.batches.slice(0, 6).map((b) => `• ${lp}: ${b.product}\n  ${lb}: ${b.batchId} · ${lm}: ${fmtDate(b.producedAt)}`);
  const body = [
    t.greet(ROLE_LABEL[role]),
    '',
    t.intro,
    '',
    ...batchLines,
    ctx.batches.length > 6 ? `• +${ctx.batches.length - 6} ${{ en: 'more batches', hi: 'और बैच', mr: 'आणखी बॅच' }[lang]}` : '',
    `• ${li}: ${ctx.description}`,
    ctx.location ? `• ${lu}: ${ctx.location.affectedUnits.toLocaleString('en-IN')}` : '',
    '',
    ...t.steps.map((s, i) => `${i + 1}. ${s}`),
    '',
    t.dont,
    '',
    `${t.sign} · ${ctx.incidentId}`,
  ].filter((l, i, arr) => !(l === '' && arr[i - 1] === '')).join('\n');
  return {
    subject: `${t.subject} · ${ctx.batches[0]?.batchId ?? ctx.sourceLot}`,
    body,
    source: 'template',
    note: lang !== language ? `No ${LANGUAGES[language]} template is built in; configure Claude (ANTHROPIC_API_KEY) for ${LANGUAGES[language]}.` : 'Claude is not configured (ANTHROPIC_API_KEY), so the built-in template was used.',
  };
}

const DraftSchema = z.object({ subject: z.string(), body: z.string() });

export async function draftRecallMessage(ctx: RecallContext, role: ContactRole, language: Language): Promise<DraftMessage> {
  if (!aiConfigured()) return templateMessage(ctx, role, language);
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: 'low', format: betaZodOutputFormat(DraftSchema) },
    system:
      'You write product-recall notices for a food and FMCG supply-chain operator in India. ' +
      'Use only the facts provided; never invent quantities, dates, names or instructions. ' +
      'The notice must tell the recipient to stop distribution and sale, quarantine remaining stock, count units on hand and already sold or dispatched, and confirm receipt. ' +
      'Keep it under 180 words, plain text with short bullet lines, and sign it "LOGIS — Automated Recall Management".',
    messages: [
      {
        role: 'user',
        content: `Write the notice in ${LANGUAGES[language]} for a ${ROLE_LABEL[role]}. Return a subject line and the body.\n\nFacts:\n${facts(ctx)}`,
      },
    ],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) {
    return { ...templateMessage(ctx, role, language), note: 'Claude did not return a usable draft, so the built-in template was used.' };
  }
  return { ...response.parsed_output, source: 'ai' };
}

const FeedbackSchema = z.object({
  answered: z.boolean(),
  acknowledged: z.boolean(),
  remainingUnits: z.number().int().nullable(),
  quarantineConfirmed: z.boolean(),
  soldOrDispatchedUnits: z.number().int().nullable(),
  distributionStopped: z.boolean(),
  needsAssistance: z.boolean(),
  escalationRequired: z.boolean(),
  escalationReason: z.string().nullable(),
  notes: z.string(),
});

export async function extractFeedback(transcript: string, ctx: RecallContext): Promise<CallFeedback> {
  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: 'low', format: betaZodOutputFormat(FeedbackSchema) },
    system:
      'You read transcripts of automated product-recall phone calls and record what the recipient actually said. ' +
      'Only mark a field true when the recipient clearly confirmed it; a call being answered is not an acknowledgement. ' +
      'Use null for quantities the recipient did not state. Set escalationRequired when they refused, were unsure, ' +
      'reported stock already sold to customers, or asked for help. notes: one or two sentences in English.',
    messages: [{ role: 'user', content: `Recall context:\n${facts(ctx)}\n\nCall transcript:\n${transcript}` }],
  });
  if (!response.parsed_output) throw new Error(response.stop_reason === 'refusal' ? 'feedback extraction was declined' : 'feedback could not be parsed');
  return response.parsed_output;
}

export function callScript(ctx: RecallContext, contactName: string, role: ContactRole, language: Language, message: string): { firstMessage: string; system: string } {
  const site = ctx.location ? `${ctx.location.name}` : 'your location';
  const firstMessage =
    language === 'hi'
      ? `नमस्ते ${contactName} जी, मैं LOGIS का स्वचालित रिकॉल सहायक हूँ। यह एक AI कॉल है। ${site} पर भेजे गए एक दोषपूर्ण उत्पाद बैच के बारे में आपसे बात करनी है। क्या आपके पास दो मिनट हैं?`
      : language === 'mr'
        ? `नमस्कार ${contactName}, मी LOGIS चा स्वयंचलित रिकॉल सहाय्यक आहे. हा AI कॉल आहे. ${site} येथे पाठवलेल्या एका सदोष उत्पादन बॅचबद्दल बोलायचे आहे. तुमच्याकडे दोन मिनिटे आहेत का?`
        : `Hello ${contactName}, this is the LOGIS automated recall assistant — an AI calling on behalf of the quality team. We're contacting you about a potentially defective product batch supplied to ${site}. Do you have two minutes?`;
  const system = [
    `You are the LOGIS automated recall assistant on a phone call with ${contactName}, ${ROLE_LABEL[role]} at ${site}. Speak ${LANGUAGES[language]}${language === 'en' ? ' (Indian English)' : ''}.`,
    'You have already said you are an automated AI assistant; if asked, confirm it again. Be calm, brief and polite — one or two short sentences per turn.',
    'Goals, in order: (1) explain which batch is affected and why; (2) ask them to stop further distribution and sale; (3) ask them to quarantine remaining stock; (4) ask how many units are still on hand; (5) ask how many were already sold or dispatched; (6) ask them to confirm they will follow the recall; (7) ask whether they need any help.',
    'Use only the facts below. Never invent quantities, dates or instructions. If they ask something you do not know, say the LOGIS quality team will follow up.',
    'If they say it is a wrong number, ask to be removed, or want no further calls, apologise, confirm, and end the call.',
    'Repeat back any quantity they give you to confirm it. When done, thank them and end the call.',
    '',
    'Facts:',
    facts(ctx),
    '',
    'Written notice they should also receive:',
    message,
  ].join('\n');
  return { firstMessage, system };
}
