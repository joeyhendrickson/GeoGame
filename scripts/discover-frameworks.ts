import dotenv from 'dotenv';
import { getEmbedding } from '../lib/openai';
import { queryPinecone } from '../lib/pinecone';

dotenv.config({ path: '.env.local' });

// Query more broadly for analysis methods, frameworks, and business concepts
const frameworkKeywords = [
  'framework',
  'matrix',
  'analysis',
  'model',
  'strategy',
  'methodology',
  'assessment',
  'evaluation',
  'competitive',
  'market',
  'business',
  'strategic planning',
  'decision making',
];

async function discoverFrameworks() {
  console.log('🔍 Searching Pinecone database for frameworks and matrices...\n');

  const discoveredFrameworks = new Map<string, { name: string; description: string; mentions: number }>();

  for (const keyword of frameworkKeywords) {
    try {
      const embedding = await getEmbedding(keyword);
      const matches = await queryPinecone(embedding, 10);

      for (const match of matches) {
        const text = (match.metadata?.text || '').toLowerCase();
        const title = (match.metadata?.title || '').toLowerCase();
        const combinedText = `${title} ${text}`;

        // Look for framework/matrix names in the text with broader patterns
        const frameworkPatterns = [
          /\b(swot|strengths weaknesses opportunities threats)\b/gi,
          /\b(pestel|political economic social technological environmental legal)\b/gi,
          /\b(porter.*?five forces?)\b/gi,
          /\b(value chain)\b/gi,
          /\b(business model canvas)\b/gi,
          /\b(competitive analysis|competitive matrix)\b/gi,
          /\b(stakeholder.*?map|stakeholder.*?analysis)\b/gi,
          /\b(risk.*?assessment|risk.*?matrix)\b/gi,
          /\b(market.*?segmentation)\b/gi,
          /\b(technology.*?roadmap|tech.*?roadmap)\b/gi,
          /\b(eisenhower.*?matrix)\b/gi,
          /\b(bcg.*?matrix|boston.*?matrix)\b/gi,
          /\b(ansoff.*?matrix|growth.*?matrix)\b/gi,
          /\b(product.*?lifecycle|plc)\b/gi,
          /\b(innovation.*?matrix)\b/gi,
          /\b(gartner.*?magic.*?quadrant)\b/gi,
          /\b(kano.*?model)\b/gi,
          /\b(blue.*?ocean.*?strategy)\b/gi,
          /\b(balanced.*?scorecard)\b/gi,
          /\b(okr.*?framework|objectives.*?key.*?results)\b/gi,
          /\b(agile.*?framework)\b/gi,
          /\b(scrum.*?framework)\b/gi,
          /\b(lean.*?methodology|lean.*?startup)\b/gi,
          /\b(design.*?thinking)\b/gi,
          /\b(double.*?diamond)\b/gi,
          /\b(jobs.*?to.*?be.*?done|jtbd)\b/gi,
          /\b(customer.*?journey.*?map)\b/gi,
          /\b(persona.*?framework|customer.*?persona)\b/gi,
        ];

        for (const pattern of frameworkPatterns) {
          if (pattern.test(combinedText)) {
            const matchText = text.match(pattern)?.[0] || title.match(pattern)?.[0] || '';
            if (matchText) {
              const frameworkName = matchText
                .split(/\s+/)
                .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
                .join(' ')
                .replace(/Swot/gi, 'SWOT')
                .replace(/Pestel/gi, 'PESTEL')
                .replace(/Okr/gi, 'OKR')
                .replace(/Jtbd/gi, 'JTBD')
                .replace(/Bcg/gi, 'BCG')
                .replace(/Plc/gi, 'PLC');

              const existing = discoveredFrameworks.get(frameworkName.toLowerCase());
              if (existing) {
                existing.mentions++;
              } else {
                // Extract description from context
                const contextStart = Math.max(0, text.indexOf(matchText) - 100);
                const contextEnd = Math.min(text.length, text.indexOf(matchText) + matchText.length + 200);
                const description = text.substring(contextStart, contextEnd)
                  .replace(/[^\w\s]/g, ' ')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .substring(0, 150) + '...';

                discoveredFrameworks.set(frameworkName.toLowerCase(), {
                  name: frameworkName,
                  description: description || 'Framework or matrix analysis tool',
                  mentions: 1,
                });
              }
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Failed to search for "${keyword}":`, error instanceof Error ? error.message : error);
    }
  }

  // Convert to array and sort by mentions
  const frameworks = Array.from(discoveredFrameworks.values())
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 30); // Top 30 frameworks

  console.log(`\n✅ Found ${frameworks.length} frameworks/matrices:\n`);
  
  for (const framework of frameworks) {
    console.log(`- ${framework.name} (${framework.mentions} mentions)`);
    console.log(`  ${framework.description}\n`);
  }

  // Generate TypeScript array format
  console.log('\n📋 Framework list for component:\n');
  console.log('const availableFrameworks: WhitepaperFramework[] = [');
  for (const framework of frameworks) {
    const id = framework.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const safeDesc = framework.description.replace(/'/g, "\\'");
    console.log(`  { id: '${id}', name: '${framework.name}', description: '${safeDesc}' },`);
  }
  console.log('];\n');

  return frameworks;
}

discoverFrameworks().catch(console.error);
