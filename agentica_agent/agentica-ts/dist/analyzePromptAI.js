import { agent } from './agent.js';
const INTENT_LIST = [
    'register_project',
    'register_lead',
    'connect_leads',
    'initial_email',
    'followup_email',
    'email_rewrite_request',
    'analyze_email',
    'handle_email_rejection',
    'list_projects',
    'list_leads',
];
export async function analyzePromptAI(prompt) {
    const messages = [
        {
            type: 'text',
            text: `
너는 지금부터 사용자 프롬프트의 의도(intent)와 필요한 파라미터를 분석하는 역할이야.

📌 중요한 규칙:
- 사용자의 입력 문장에는 반드시 **단 하나의 intent만** 존재한다고 가정해.
- 복수 intent가 연상되더라도, **가장 중심이 되는 의도 하나만** 선택해.
- 절대 여러 intent를 동시에 포함하거나 나열하지 마.
- 반드시 아래 JSON 형식으로만 응답해. 그 외 설명은 절대 포함하지 마.
- 형식을 어기면 시스템은 너의 응답을 무시하고 fallback 처리를 한다.

응답 형식:
{
  "intent": "register_project|register_lead|connect_leads|initial_email|followup_email|email_rewrite_request|analyze_email|handle_email_rejection|list_projects|list_leads|unknown",
  "extracted_params": {
    "userPrompt": "사용자가 입력한 전체 문장 그대로"
  },
  "confidence": 0.0
}
`.trim()
        },
        { type: 'text', text: prompt }
    ];
    try {
        const resultHistories = await agent.conversate(messages);
        const lastHistory = Array.isArray(resultHistories)
            ? resultHistories[resultHistories.length - 1]
            : resultHistories;
        const lastText = typeof lastHistory === 'string'
            ? lastHistory
            : lastHistory.content ?? lastHistory.text ?? '';
        try {
            const parsed = JSON.parse(lastText);
            if (parsed.intent && INTENT_LIST.includes(parsed.intent)) {
                console.log('🧠 analyzePromptAI 결과:', JSON.stringify(parsed, null, 2));
                return parsed;
            }
        }
        catch { }
        // fallback으로 넘어감
        return fallbackInferIntent(prompt);
    }
    catch {
        return fallbackInferIntent(prompt);
    }
}
// fallback 기반 intent 추론기
function fallbackInferIntent(prompt) {
    const lower = prompt.toLowerCase();
    console.log('🔍 fallback 분석 중:', { prompt, lower });
    const scoringRules = [
        {
            intent: 'register_project',
            mustInclude: ['사업'],
            optional: ['프로젝트', '등록', '추가', '시작', '진행', '런칭', '설립', '개발', '추진', '할거야', '등록해줘'],
        },
        {
            intent: 'register_lead',
            mustInclude: ['기업', '회사', '고객', '리드'],
            optional: ['등록', '추가', 'lead', '담당', '이메일'],
        },
        {
            intent: 'connect_leads',
            mustInclude: ['연결'],
            optional: ['기업', '리드', '프로젝트', '사업', 'auto-connect'],
        },
        {
            intent: 'initial_email',
            mustInclude: ['메일'],
            optional: ['작성', '써', '초안', '제안', '보내', '보내줘', '기업', '회사', '소개', '제공', '여러', '다중']
        },
        {
            intent: 'followup_email',
            mustInclude: ['후속'],
            optional: ['메일', '다시', '보내', 'follow'],
        },
        {
            intent: 'email_rewrite_request',
            mustInclude: ['메일'],
            optional: ['다시', '수정', '별로', '재작성', '고쳐', '거부'],
        },
        {
            intent: 'analyze_email',
            mustInclude: ['분석'],
            optional: ['품질', '진단', '이메일'],
        },
        {
            intent: 'list_projects',
            mustInclude: ['리스트', '목록', '보여줘', '전체'],
            optional: ['사업', '프로젝트'],
        },
        {
            intent: 'list_leads',
            mustInclude: ['리스트', '목록', '보여줘', '전체'],
            optional: ['기업', '리드', '회사', '고객'],
        },
    ];
    let bestIntent = 'unknown';
    let bestScore = 0;
    for (const rule of scoringRules) {
        const hasMust = rule.mustInclude.every(k => lower.includes(k));
        console.log(`🔍 ${rule.intent} 체크:`, {
            mustInclude: rule.mustInclude,
            hasMust,
            optional: rule.optional.filter(k => lower.includes(k))
        });
        if (!hasMust)
            continue;
        const optionalMatches = rule.optional.filter(k => lower.includes(k)).length;
        const score = optionalMatches + 1;
        if (score > bestScore) {
            bestIntent = rule.intent;
            bestScore = score;
        }
    }
    return {
        intent: bestIntent,
        extracted_params: { userPrompt: prompt },
        confidence: bestIntent === 'unknown' ? 0 : Math.min(0.95, 0.4 + bestScore * 0.1),
    };
}
