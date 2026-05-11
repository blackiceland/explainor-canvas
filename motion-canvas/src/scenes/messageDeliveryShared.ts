import {ColorRule} from '../core/code/components/Manticore';

// ── palette ─────────────────────────────────────────────────────────────
export const VAR_LIGHT    = 'rgba(244,241,235,0.96)';
export const TYPE_CLEAN   = 'rgba(220,215,255,0.80)';
export const METHOD_COLOR = '#FF8CA3';
export const FUN_BLUE     = '#A3CDFF';

// Per-boolean accents (each far from the syntax palette above).
export const DRYRUN_COLOR    = '#92D4B0';  // mint  — preview
export const FORCESEND_COLOR = '#E5C175';  // amber — override
export const ISRETRY_COLOR   = '#7AC9C9';  // teal  — retry

export const CODE_CARD_STYLE = {
  radius: 0,
  fill: 'rgba(0,0,0,0)',
  stroke: 'rgba(0,0,0,0)',
  strokeWidth: 0,
  shadowColor: 'rgba(0,0,0,0)',
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  edge: false,
} as const;

export const CUSTOM_TYPES = [
  'MessageRenderer',
  'DeliveryRules',
  'DeliveryAttempts',
  'MessageGateway',
  'User',
  'MessageTemplate',
  'Boolean',
  'DeliveryResult',
  'DeliveryDecision',
  'Preview',
  'Deferred',
  'Sent',
  'Blocked',
];

export const COLOR_RULES: ColorRule[] = [
  {match: /^fun$/, color: FUN_BLUE},
  {match: /^val$/, color: FUN_BLUE},
  {match: /^is$/,  color: FUN_BLUE},

  {match: /^render$/,    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^check$/,     color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^create$/,    color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^nextRetry$/, color: METHOD_COLOR, onlyTypes: ['method']},
  {match: /^send$/,      color: METHOD_COLOR, onlyTypes: ['method']},

  {match: /^user$/,     color: VAR_LIGHT},
  {match: /^template$/, color: VAR_LIGHT},
  {match: /^message$/,  color: VAR_LIGHT},
  {match: /^decision$/, color: VAR_LIGHT},
  {match: /^attempt$/,  color: VAR_LIGHT},
  {match: /^receipt$/,  color: VAR_LIGHT},
  {match: /^renderer$/, color: VAR_LIGHT},
  {match: /^rules$/,    color: VAR_LIGHT},
  {match: /^attempts$/, color: VAR_LIGHT},
  {match: /^gateway$/,  color: VAR_LIGHT},

  {match: /^(MessageRenderer|DeliveryRules|DeliveryAttempts|MessageGateway|User|MessageTemplate|Boolean|DeliveryResult|DeliveryDecision|Preview|Deferred|Sent|Blocked)$/,
   color: TYPE_CLEAN, onlyTypes: ['type']},
];

export const CODE = `fun sendMessage(
    user: User,
    template: MessageTemplate,
    dryRun: Boolean,
    forceSend: Boolean,
    isRetry: Boolean,
): DeliveryResult {
    val message = renderer.render(template, user)

    if (dryRun) {
        return DeliveryResult.Preview(message)
    }

    if (!forceSend) {
        val decision = rules.check(user, message)

        if (decision is DeliveryDecision.Blocked) {
            return DeliveryResult.Deferred(decision.reason)
        }
    }

    val attempt =
        if (isRetry) attempts.nextRetry(user, message)
        else attempts.create(user, message)

    val receipt = gateway.send(user, message, attempt)

    return DeliveryResult.Sent(receipt)
}`;

export const CODE_FONT = 22;
export const CODE_LH   = 33;
export const CODE_W    = 920;
// Code is shifted left so the right ~900px of the frame stay clear for
// the right-column visualization. Card center at -460 → card edges at
// [-920, 0].
export const CODE_X    = -460;

export const LINE = {
  sigDryRun:    3,
  sigForceSend: 4,
  sigIsRetry:   5,
  // Influence zones (inclusive).
  zoneDryRun:    [9, 11]  as const,
  zoneForceSend: [13, 19] as const,
  zoneIsRetry:   [21, 23] as const,
};
