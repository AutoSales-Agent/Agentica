import { agent } from '../agent.js';
import { springService } from '../services/springService.js';
import { OpenAI } from 'openai';
import dotenv from 'dotenv';
import axios from 'axios';
import open from 'open';
dotenv.config({ override: true });
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});
function chunk(arr, size = 4) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
export async function generateInitialEmail({ userPrompt }) {
    console.log('📧 이메일 생성 시작:', userPrompt);

    // 1. OpenAI로 파라미터 추출 (Agentica 사용 안함)
    const extractPrompt = `
다음 요청에서 프로젝트명과 기업명들을 JSON으로 추출하세요:
"${userPrompt}"

정확히 이 형식으로만 답하세요:
{"projectName": "프로젝트명", "leadNames": ["기업1", "기업2"]}
`;

    // 1. OpenAI로 파라미터 추출
    const extractPrompt = `
다음 요청에서 프로젝트명과 기업명들을 JSON으로 추출하세요:
"${userPrompt}"

정확히 이 형식으로만 답하세요:
{"projectName": "프로젝트명", "leadNames": ["기업1", "기업2"]}
  `;

    let extractText;
    try {
        const extractResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: extractPrompt }],
            temperature: 0.1,
        });
        extractText = extractResponse.choices[0]?.message?.content || '';
        console.log('🔥 extractText:', extractText);
    }
    catch (error) {
        console.error('OpenAI 호출 오류:', error);
        return [{ status: 'error', error: 'AI 서비스 호출 실패' }];
    }
    // 2. JSON 파싱
    const cleaned = extractText.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{.*\}/s);
    if (!match) {
        return [{ status: 'error', error: '파라미터 추출 실패 - JSON 형식을 찾을 수 없음' }];
    }
    let parsed;
    try {
        parsed = JSON.parse(match[0]);
        if (!parsed.projectName || !Array.isArray(parsed.leadNames) || parsed.leadNames.length === 0) {
            return [{ status: 'error', error: 'projectName 또는 leadNames가 올바르지 않음' }];
        }
    }
    catch (error) {
        console.error('JSON 파싱 오류:', error);
        return [{ status: 'error', error: 'JSON 파싱 실패' }];
    }
    // 3. 프로젝트 조회
    const project = await springService.getProjectByName(parsed.projectName.trim());
    if (!project) {
        return [{ status: 'error', error: `프로젝트 '${parsed.projectName}' 를 찾을 수 없음` }];
    }
    // 4. 기업 정보 조회
    const leadResults = await Promise.all(parsed.leadNames.map(name => springService.getLeadByName(name.trim())));
    const validLeads = leadResults.filter((l) => Boolean(l));
    if (validLeads.length === 0) {
        return [{ status: 'error', error: '유효한 기업을 찾을 수 없음' }];
    }
    console.log(`✅ 발견된 기업: ${validLeads.map(l => l.name).join(', ')}`);
    const results = [];
    const emailPayloads = [];

    // 5. 각 기업별로 맞춤 이메일 생성 (OpenAI 직접 호출)
    for (const lead of validLeads) {
        console.log(`📝 ${lead.name} 맞춤 이메일 생성 중...`);
        const mailPrompt = `
당신은 전문 B2B 세일즈 이메일 작성자입니다.
당사의 이름은 autosales이고 이 메일을 보내는 사람의 이름은 심규성, 연락처 정보는 sks02040204@gmail.com 입니다.
사용자 요청: "${userPrompt}"
프로젝트 설명: ${project.description}

타겟 고객 정보:
- 회사명: ${lead.name}
- 산업분야: ${lead.industry}
- 담당자: ${lead.contactName || '담당자님'}
- 회사규모: ${lead.size || '미정'}
- 언어: ${lead.language || '한국어'}

이 고객의 특성에 맞는 맞춤형 B2B 제안 이메일을 작성하세요.
해당 산업의 pain point와 우리 솔루션이 어떻게 도움이 될지 구체적으로 설명하세요.

정확히 이 JSON 형식으로만 답하세요:
{"subject":"이메일 제목","body":"이메일 본문"}
`;
=======
    // 5. 마이크로 배치로 메일 생성
    const leadGroups = chunk(validLeads, 4); // 3~5로 조절 가능
    for (const group of leadGroups) {
        const mailPrompt = `
당신은 전문 B2B 세일즈 이메일 작성자입니다.
당사의 이름은 autosales이고 이 메일을 보내는 사람의 이름은 심규성, 연락처 정보는 sks02040204@gmail.com 입니다.
사용자 요청: "${userPrompt}"
프로젝트 설명: ${project.description}

대상 고객 리스트:
${group.map((lead, idx) => `
${idx + 1}.
- 회사명: ${lead.name}
- 산업분야: ${lead.industry}
- 담당자: ${lead.contactName || '담당자님'}
- 회사규모: ${lead.size || '미정'}
- 언어: ${lead.language || '한국어'}
`).join('\n')}

각 회사에 맞는 맞춤형 B2B 제안 이메일을 작성하세요.
반드시 JSON 배열 형식으로만 답하세요:
[
  {"companyName":"...", "subject":"...", "body":"..."},
  ...
]
    `;
        try {
            const mailResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: [{ role: "user", content: mailPrompt }],
                temperature: 0.7,
            });
            const mailText = mailResponse.choices[0]?.message?.content || '';
            const mailMatch = mailText.match(/\[.*\]/s);
            if (!mailMatch) {
                group.forEach(lead => results.push({
                    companyName: lead.name,
                    status: 'error',
                    error: 'JSON 형식 오류'
                }));
                continue;
            }
            let parsedBatch;
            try {
                parsedBatch = JSON.parse(mailMatch[0]);
            }
            catch {
                group.forEach(lead => results.push({
                    companyName: lead.name,
                    status: 'error',
                    error: 'JSON 파싱 실패'
                }));
                continue;
            }
            for (const item of parsedBatch) {
                const lead = group.find(l => l.name === item.companyName);
                if (!lead || !item.subject || !item.body) {
                    results.push({
                        companyName: item.companyName || 'Unknown',
                        status: 'error',
                        error: '제목 또는 본문 누락'
                    });
                    continue;
                }
                results.push({
                    companyName: lead.name,
                    status: 'success',
                    subject: item.subject,
                    body: item.body,
                    contactEmail: lead.contactEmail,
                    projectId: project.id,
                    leadId: lead.id,
                    preview: item.body.substring(0, 150) + '...'
                });
                emailPayloads.push({
                    projectId: project.id,
                    leadId: lead.id,
                    subject: item.subject,
                    body: item.body,
                    contactEmail: lead.contactEmail,
                });
            }
        }
        catch (error) {
            console.error('배치 메일 생성 오류:', error);
            group.forEach(lead => results.push({
                companyName: lead.name,
                status: 'error',
                error: 'AI 호출 실패'
            }));
        }
    }
    // 6. Spring으로 한 번에 전송
    if (emailPayloads.length > 0) {
        try {
            const response = await axios.post('http://localhost:8080/emails/drafts', emailPayloads);
            console.log('📨 Spring에 이메일 리스트 전송 완료');
            const sessionId = response.data.sessionId;
            if (sessionId) {
                const url = `http://localhost:8080/emails/drafts?sessionId=${sessionId}`;
                console.log('📬 초안 확인 페이지:', url);
                await open(url);
            }
        }
        catch (error) {
            console.error('❌ Spring 전송 실패:', error);
        }
    }
    console.log('🎉 전체 이메일 생성 완료');
    return results; // 항상 배열 반환
}
// 2. 후속 메일 생성
export async function generateFollowupEmail({ userPrompt }) {
    const idPrompt = `
아래 프롬프트에서 projectId, leadId, feedbackSummary(고객 피드백 요약)를 추출해.
예시: {"projectId":1, "leadId":2, "feedbackSummary":"가격이 비싸다고 응답"}
`.trim();
    const idResult = await agent.conversate([
        { type: 'text', text: idPrompt },
        { type: 'text', text: userPrompt }
    ]);
    const lastId = Array.isArray(idResult) ? idResult[idResult.length - 1] : idResult;
    const idText = typeof lastId === 'string'
        ? lastId
        : lastId.content ?? lastId.text ?? '';
    const idMatch = idText.match(/\{.*\}/s);
    if (!idMatch)
        return { status: 'error', error: '파라미터 추출 실패' };
    const { projectId, leadId, feedbackSummary } = JSON.parse(idMatch[0]);
    const project = await springService.getProjectById(projectId);
    const lead = await springService.getLeadById(leadId);
    
    // 사용자 프롬프트에서 이전 이메일 ID 추출 시도
    let previousEmailId = null;
    const emailIdMatch = userPrompt.match(/이전\s*이메일.*?(\d+)/i) || userPrompt.match(/이메일\s*(\d+)/i);
    if (emailIdMatch) {
        previousEmailId = parseInt(emailIdMatch[1]);
    }
    
    // 이전 이메일 정보가 있으면 가져오기
    let previousEmailInfo = '';
    if (previousEmailId) {
        try {
            const previousEmail = await springService.getEmailById(previousEmailId);
            if (previousEmail) {
                previousEmailInfo = `\n이전 이메일: ${JSON.stringify(previousEmail)}`;
            }
        } catch (error) {
            console.log('이전 이메일 조회 실패:', error);
        }
    }
    
    const systemPrompt = `
피드백, 사업설명, 고객정보를 참고해 후속 B2B 세일즈 이메일을 JSON으로만 생성.

고객 상황별 전략적 접근:

1. **무응답 상황** (첫 이메일 후 응답 없음):
   - 가치 제안 재강조, 구체적 혜택 명시
   - 시간 제한적 제안 (한정 기간 할인, 무료 체험)
   - 간단한 질문으로 대화 시작

2. **관심 있음** (긍정적 반응):
   - 구체적 데모/사례 제시
   - ROI 계산 및 수치화
   - 다음 단계 명확히 제시

3. **예산 우려**:
   - 가격 조정 옵션, 분할 결제
   - 투자 대비 효과 강조
   - 단계별 도입 방안

4. **경쟁사 비교**:
   - 차별화 포인트 강조
   - 고객 성공 사례
   - 무료 비교 분석 제안

5. **의사결정 과정**:
   - 의사결정자별 맞춤 정보
   - 리스크 완화 방안
   - 단계별 진행 계획

6. **기술적 세부사항 요구**:
   - 기술 백서, 상세 자료
   - 기술 담당자 연결
   - 맞춤형 솔루션 제안

7. **부정적 반응**:
   - 우려사항 구체적 해결
   - 보장 및 리스크 완화
   - 대안 제시

정확히 이 JSON 형식으로만 답하세요:
{"subject":"제목", "body":"본문", "strategy":"사용된 전략"}
`.trim();
    const mailResult = await agent.conversate([
        { type: 'text', text: systemPrompt },
        { type: 'text', text: `사업 설명: ${project.description}\n고객 정보: ${JSON.stringify(lead)}\n피드백: ${feedbackSummary}${previousEmailInfo}\n\n고객 피드백을 분석하여 위의 7가지 상황 중 가장 적합한 전략을 선택하고, 해당 전략에 맞는 구체적이고 설득력 있는 이메일을 작성하세요.` }
    ]);
    const lastMail = Array.isArray(mailResult) ? mailResult[mailResult.length - 1] : mailResult;
    const mailText = typeof lastMail === 'string'
        ? lastMail
        : lastMail.content ?? lastMail.text ?? '';
    const match = mailText.match(/\{.*\}/s);
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            const newEmail = await springService.saveEmail(projectId, leadId, parsed.subject, parsed.body);
            
            // 이전 이메일이 있으면 피드백 저장
            if (previousEmailId) {
                try {
                    await springService.submitFeedback({ 
                        emailId: previousEmailId, 
                        feedbackText: feedbackSummary 
                    });
                } catch (error) {
                    console.log('피드백 저장 실패:', error);
                }
            }
            
            return { 
                subject: parsed.subject, 
                body: parsed.body, 
                strategy: parsed.strategy,
                status: 'success',
                newEmailId: newEmail.id
            };
        }
        catch {
            return { status: 'error', error: '후속 이메일 JSON 파싱 실패' };
        }
    }
    return { status: 'error', error: '후속 이메일 생성 실패' };
}
// 3. 이메일 재작성 (피드백 기반)
export async function regenerateEmailWithFeedback({ userPrompt }) {
    const paramPrompt = `
아래 프롬프트에서 projectId, leadId, originalEmail(제목/본문), userFeedback을 추출해.
예시: {"projectId":1, "leadId":2, "originalEmail":{"subject":"...","body":"..."},"userFeedback":"별로라고 함"}
`.trim();
    const paramResult = await agent.conversate([
        { type: 'text', text: paramPrompt },
        { type: 'text', text: userPrompt }
    ]);
    const lastParam = Array.isArray(paramResult) ? paramResult[paramResult.length - 1] : paramResult;
    const paramText = typeof lastParam === 'string'
        ? lastParam
        : lastParam.content ?? lastParam.text ?? '';
    const paramMatch = paramText.match(/\{.*\}/s);
    if (!paramMatch)
        return { status: 'error', error: '파라미터 추출 실패' };
    const { projectId, leadId, originalEmail, userFeedback } = JSON.parse(paramMatch[0]);
    const project = await springService.getProjectById(projectId);
    const lead = await springService.getLeadById(leadId);
    
    // 사용자 프롬프트에서 추가 정보 추출 시도
    let emailId = null;
    let reviewType = null;
    
    // 이메일 ID 추출
    const emailIdMatch = userPrompt.match(/이메일\s*ID.*?(\d+)/i) || userPrompt.match(/ID.*?(\d+)/i);
    if (emailIdMatch) {
        emailId = parseInt(emailIdMatch[1]);
    }
    
    // 검수 유형 추출
    if (userPrompt.includes('content') || userPrompt.includes('내용')) {
        reviewType = 'content';
    } else if (userPrompt.includes('tone') || userPrompt.includes('톤')) {
        reviewType = 'tone';
    } else if (userPrompt.includes('structure') || userPrompt.includes('구조')) {
        reviewType = 'structure';
    } else if (userPrompt.includes('all') || userPrompt.includes('전체')) {
        reviewType = 'all';
    }
    
    // 검수 유형에 따른 개선 방향 설정
    let improvementPrompt = '';
    if (reviewType) {
        switch (reviewType) {
            case 'content':
                improvementPrompt = '내용을 더 구체적이고 이해하기 쉽게 개선하세요.';
                break;
            case 'tone':
                improvementPrompt = '톤을 더 친근하고 접근하기 쉽게 조정하세요.';
                break;
            case 'structure':
                improvementPrompt = '구조를 더 명확하고 논리적으로 재구성하세요.';
                break;
            case 'all':
                improvementPrompt = '전체적으로 개선하세요.';
                break;
            default:
                improvementPrompt = '사용자 피드백에 따라 개선하세요.';
        }
    }
    
    const systemPrompt = `
아래 정보(사업/고객/원본이메일/피드백)를 참고해 개선된 이메일을 JSON으로만 재작성.

${improvementPrompt ? `개선 방향: ${improvementPrompt}` : ''}

정확히 이 JSON 형식으로만 답하세요:
{"subject":"개선된 제목", "body":"개선된 본문", "improvements":["개선사항1", "개선사항2"]}
`.trim();
    const mailResult = await agent.conversate([
        { type: 'text', text: systemPrompt },
        { type: 'text', text: `사업 설명: ${project.description}\n고객 정보: ${JSON.stringify(lead)}\n원본 이메일: ${JSON.stringify(originalEmail)}\n피드백: ${userFeedback}` }
    ]);
    const lastMail = Array.isArray(mailResult) ? mailResult[mailResult.length - 1] : mailResult;
    const mailText = typeof lastMail === 'string'
        ? lastMail
        : lastMail.content ?? lastMail.text ?? '';
    const match = mailText.match(/\{.*\}/s);
    if (match) {
        try {
            const parsed = JSON.parse(match[0]);
            
            // emailId가 있으면 업데이트, 없으면 새로 저장
            let result;
            if (emailId) {
                result = await springService.updateEmail(emailId, {
                    subject: parsed.subject,
                    body: parsed.body
                });
            } else {
                result = await springService.saveEmail(projectId, leadId, parsed.subject, parsed.body);
            }
            
            return { 
                subject: parsed.subject, 
                body: parsed.body, 
                improvements: parsed.improvements,
                status: 'success',
                emailId: emailId || result.id
            };
        }
        catch {
            return { status: 'error', error: '재작성 JSON 파싱 실패' };
        }
    }
    return { status: 'error', error: '이메일 재작성 실패' };
}

// 9. 이메일 목록 조회 (누락된 함수)
export async function listEmails() {
    try {
        const emails = await springService.listEmails();
        return {
            status: 'success',
            data: emails
        };
    } catch (error) {
        console.error('이메일 목록 조회 실패:', error);
        return {
            status: 'error',
            error: '이메일 목록 조회 실패'
        };
    }
}
// 4. 이메일 품질 분석
export async function analyzeEmailIssues({ userPrompt }) {
    const paramPrompt = `
아래 프롬프트에서 emailContent(제목/본문), userFeedback을 추출해.
예시: {"emailContent":{"subject":"...","body":"..."},"userFeedback":"내용이 너무 두루뭉술"}
`.trim();
    const paramResult = await agent.conversate([
        { type: 'text', text: paramPrompt },
        { type: 'text', text: userPrompt }
    ]);
    const lastParam = Array.isArray(paramResult) ? paramResult[paramResult.length - 1] : paramResult;
    const paramText = typeof lastParam === 'string'
        ? lastParam
        : lastParam.content ?? lastParam.text ?? '';
    const paramMatch = paramText.match(/\{.*\}/s);
    if (!paramMatch)
        return { status: 'error', error: '파라미터 추출 실패' };
    const { emailContent, userFeedback } = JSON.parse(paramMatch[0]);
    const systemPrompt = `
사용자 피드백 기반 이메일 문제점/개선방안/priority를 아래 JSON만으로 응답.
예시: {"issues":["제목이 두루뭉술함"],"suggestions":["제목 구체화"],"priority":"high"}
priority: high|medium|low
`.trim();
    const mailResult = await agent.conversate([
        { type: 'text', text: systemPrompt },
        { type: 'text', text: `이메일 내용:\n제목: ${emailContent.subject}\n본문: ${emailContent.body}\n사용자 피드백: ${userFeedback}` }
    ]);
    const lastMail = Array.isArray(mailResult) ? mailResult[mailResult.length - 1] : mailResult;
    const mailText = typeof lastMail === 'string'
        ? lastMail
        : lastMail.content ?? lastMail.text ?? '';
    const match = mailText.match(/\{.*\}/s);
    if (match) {
        try {
            return JSON.parse(match[0]);
        }
        catch {
            return { status: 'error', error: '분석 JSON 파싱 실패' };
        }
    }
    return { status: 'error', error: '이메일 분석 실패' };
}
// 5. 이메일 거부 처리 (분석 후 분기)
export async function handleEmailRejection({ userPrompt }) {
    // 품질 분석 먼저
    const analysis = await analyzeEmailIssues({ userPrompt });
    // 심각하면 재작성, 아니면 개선안 안내
    if (analysis.priority === 'high' || (analysis.issues && analysis.issues.length > 2)) {
        return await regenerateEmailWithFeedback({ userPrompt });
    }
    return {
        action: 'improve',
        analysis,
        message: '분석 결과를 참고하여 이메일을 개선하세요.'
    };
}
// 6. 다중 기업용 메일 일괄 생성
export async function generateEmailsForMultipleLeads({ userPrompt }) {
    const paramPrompt = `
아래 프롬프트에서 projectId, leadIds(배열) 추출. 예시: {"projectId":1,"leadIds":[2,3,4]}
`.trim();
    const paramResult = await agent.conversate([
        { type: 'text', text: paramPrompt },
        { type: 'text', text: userPrompt }
    ]);
    const lastParam = Array.isArray(paramResult) ? paramResult[paramResult.length - 1] : paramResult;
    const paramText = typeof lastParam === 'string'
        ? lastParam
        : lastParam.content ?? lastParam.text ?? '';
    const paramMatch = paramText.match(/\{.*\}/s);
    if (!paramMatch)
        return { status: 'error', error: '파라미터 추출 실패' };
    const { projectId, leadIds } = JSON.parse(paramMatch[0]);
    const project = await springService.getProjectById(projectId);
    const results = [];
    for (const leadId of leadIds) {
        const lead = await springService.getLeadById(leadId);
        const systemPrompt = `
아래 사업설명, 고객정보 기반 맞춤 이메일을 JSON으로만 생성.
예시: {"subject":"제목","body":"본문"}
`.trim();
        const mailResult = await agent.conversate([
            { type: 'text', text: systemPrompt },
            { type: 'text', text: `사업 설명: ${project.description}\n고객 정보: ${JSON.stringify(lead)}` }
        ]);
        const lastMail = Array.isArray(mailResult) ? mailResult[mailResult.length - 1] : mailResult;
        const mailText = typeof lastMail === 'string'
            ? lastMail
            : lastMail.content ?? lastMail.text ?? '';
        const match = mailText.match(/\{.*\}/s);
        if (match) {
            try {
                const parsed = JSON.parse(match[0]);
                await springService.saveEmail(projectId, leadId, parsed.subject, parsed.body);
                results.push({ leadId, subject: parsed.subject, body: parsed.body, status: 'success' });
            }
            catch {
                results.push({ leadId, status: 'error', error: 'JSON 파싱 실패' });
            }
        }
        else {
            results.push({ leadId, status: 'error', error: '이메일 생성 실패' });
        }
    }
    return { type: 'multiple_initial_emails', projectId, results };
}
