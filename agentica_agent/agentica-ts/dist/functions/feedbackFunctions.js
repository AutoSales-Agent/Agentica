import { agent } from '../agent.js';
import { springService } from '../services/springService.js';
// 피드백 등록
export async function submitFeedback({ userPrompt }) {
    const systemPrompt = `
아래 프롬프트에서 emailId(이메일 id), feedbackText(피드백)를 추출해 JSON으로만 반환.
예시: {"emailId":1, "feedbackText":"답장이 없어서 다시 보내달라고 요청함"}
`.trim();
    const result = await agent.conversate([
        { type: 'text', text: systemPrompt },
        { type: 'text', text: userPrompt }
    ]);
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    const lastText = typeof last === 'string'
        ? last
        : last.content ?? last.text ?? '';
    const match = lastText.match(/\{.*\}/s);
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            if (!parsed.emailId || !parsed.feedbackText)
                return { status: 'error', error: 'emailId 또는 feedbackText 추출 실패' };
            return await springService.submitFeedback(parsed);
        }
        catch {
            return { status: 'error', error: 'JSON 파싱 실패' };
        }
    }
    return { status: 'error', error: '피드백 정보 추출 실패' };
}
// 피드백 요약/분석
export async function summarizeFeedback({ leadName, projectName, subject, body }) {
    const prompt = `
다음은 '${projectName}' 사업에 대해 '${leadName}' 고객이 보낸 회신 이메일입니다.

내용을 정확히 분석해서 아래 두 항목을 정확히 작성하세요:

1. 회신 요약: 핵심 내용을 1~2문장으로 요약하세요.
2. 응답 유형: 반드시 아래 다섯 가지 중 하나만 골라 소문자로 적으세요
   - positive
   - neutral
   - negative
   - out-of-office
   - unreadable

형식 예시:
1. 제안을 거절하고 정중히 감사 인사를 전함.
2. negative

제목: ${subject}
내용:
${body}
`.trim();
    const result = await agent.conversate([{ type: 'text', text: prompt }]); // ✅ 여기가 GPT 호출
    const last = Array.isArray(result) ? result[result.length - 1] : result;
    const text = typeof last === 'string'
        ? last
        : last.content ?? last.text ?? '';
    const match = text.match(/1[.)\-:]?\s*(.+?)\s*2[.)\-:]?\s*(.+)/s);
    if (!match) {
        return {
            status: 'error',
            error: 'GPT 응답 파싱 실패',
            raw: text
        };
    }
    return {
        status: 'success',
        summary: match[1].trim(),
        responseType: match[2].trim().toLowerCase()
    };
}
// 피드백 전체 분석 및 저장 트리거
export async function handleFeedbackSummary({ leadName, projectName, subject, body }) {
    return await summarizeFeedback({ leadName, projectName, subject, body });
}
