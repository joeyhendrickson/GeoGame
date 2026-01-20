import { NextRequest, NextResponse } from 'next/server';
import { chatCompletion, getEmbedding } from '@/lib/openai';
import { queryPinecone } from '@/lib/pinecone';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun, AlignmentType, HeadingLevel, Media } from 'docx';
import PptxGenJS from 'pptxgenjs';

// Allow longer execution time for whitepaper generation
export const maxDuration = 300; // 5 minutes

type WritingStyle = 'easy-read' | 'professional' | 'executive';

const frameworkQueries: Record<string, string> = {
  // Standard Business Frameworks
  swot: 'SWOT analysis strengths weaknesses opportunities threats',
  pestel: 'PESTEL analysis political economic social technological environmental legal factors',
  porter: 'Porter five forces industry competition analysis competitive rivalry supplier power buyer power threat substitution',
  'value-chain': 'value chain analysis primary activities support activities competitive advantage',
  'business-model-canvas': 'business model canvas value proposition customer segments channels revenue streams key resources',
  'competitive-analysis': 'competitive analysis matrix market positioning competitive landscape',
  'stakeholder-map': 'stakeholder mapping key stakeholders interests influence',
  'risk-assessment': 'risk assessment matrix risk identification mitigation strategies',
  'market-segmentation': 'market segmentation target market analysis customer segments',
  'technology-roadmap': 'technology roadmap technology adoption evolution timeline innovation',
  // Geolocation Games Research-Specific Frameworks
  'geogame-design-review-matrix': 'GeoGame design review matrix evaluation early-warning system failure risks geolocation game design',
  'failure-taxonomy': 'game failure taxonomy geolocation failure modes platform trend dependency abstract design value proposition risk mitigation',
  'standard-case-study-template': 'case study template failed discontinued games analysis documentation insights comparison',
  'comparative-analysis-failures-vs-successes': 'comparative analysis failures Pokémon GO Geocaching success factors exemplars non-obvious factors',
  'success-framework-stress-test': 'success framework stress test evaluate concept strategic soundness weak points',
  'do-not-build-checklist': 'do not build checklist anti-patterns high-risk assumptions cultural mismatch competition continuity',
  'total-addressable-market-tam': 'total addressable market TAM estimate market sizing geolocation game concept opportunity assessment',
  'platform-dependency-risk-assessment': 'platform trend dependency risk assessment external platforms platform strategies Facebook systemic risk',
  'core-loop-analysis': 'core loop analysis player mechanics underexplored core loops historical failure modes market unexhausted',
};

const writingStylePrompts: Record<WritingStyle, string> = {
  'easy-read': `Write in a high school reading level style that is comfortable, conversational, and easy to understand. 
Use simple language and clear explanations. Present technical concepts, business concepts, and big ideas in laymen's terms. 
Avoid jargon unless necessary, and when you do use it, explain it immediately. Make complex topics accessible to everyone.`,

  'professional': `Write from a researcher's perspective using expert terminology when appropriate. Use specialist and expert 
terms when explaining technical or business concepts. Maintain an academic and professional tone. Include proper technical 
terminology that demonstrates deep understanding of the subject matter.`,

  'executive': `Write in a consolidated, executive summary style. Organize information in point-by-point narrative form with 
clear takeaways. Each major section should have payoff conclusions that show the investor or business-minded reader the 
business value and key insights. Focus on actionable insights and strategic implications. Be concise and value-driven.`,
};

async function generateImage(prompt: string): Promise<string | null> {
  try {
    const googleApiKey = process.env.GOOGLE_AI_API_KEY;
    if (!googleApiKey) {
      console.warn('[generateImage] GOOGLE_AI_API_KEY not found');
      return null;
    }

    console.log(`[generateImage] Requesting image generation with prompt: ${prompt.substring(0, 100)}...`);
    
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.4 },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[generateImage] API error (${response.status}):`, errorText);
      return null;
    }

    const data = await response.json();
    console.log(`[generateImage] API response received, candidates: ${data.candidates?.length || 0}`);
    
    const candidates = data.candidates || [];
    for (const candidate of candidates) {
      const parts = candidate.content?.parts || [];
      for (const part of parts) {
        if (part.inline_data) {
          const imageData = part.inline_data.data;
          console.log(`[generateImage] ✅ Image generated successfully (${imageData.length} chars)`);
          return imageData; // Base64 image
        }
        if (part.text && part.text.startsWith('data:image/')) {
          const imageData = part.text.split(',')[1];
          console.log(`[generateImage] ✅ Image extracted from text (${imageData.length} chars)`);
          return imageData; // Extract base64 from data URL
        }
      }
    }
    
    console.warn('[generateImage] No image data found in response');
    if (data.candidates && data.candidates.length > 0) {
      console.warn('[generateImage] Response structure:', JSON.stringify(data.candidates[0], null, 2).substring(0, 500));
    }
  } catch (error) {
    console.error('[generateImage] Image generation failed:', error);
  }
  return null;
}

async function generateWhitepaperPDF(
  content: string,
  images: Array<{ pageIndex: number; base64: string }>,
  numPages: number
): Promise<Buffer> {
  // Validate content
  if (!content || content.trim().length === 0) {
    throw new Error('Cannot generate PDF: content is empty');
  }

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let currentPage = pdfDoc.addPage([612, 792]);
  const { width, height } = currentPage.getSize();
  
  // Tailwind-like spacing design system
  const margin = 72; // 1 inch margins (72 points)
  const topMargin = 72;
  const bottomMargin = 72;
  
  // Typography sizes (following design system)
  const fontSize = 12; // Body text: 12pt font
  const headingFontSize = 18; // Main headings: 18pt bold
  const subHeadingFontSize = 16; // Subheadings: 16pt bold
  
  // Line heights (Tailwind-like: 1.5 for body, 1.2 for headings)
  const bodyLineHeight = fontSize * 1.5; // 18pt line height for 12pt text
  const headingLineHeight = headingFontSize * 1.2; // 21.6pt for headings
  const subHeadingLineHeight = subHeadingFontSize * 1.3; // ~21pt for subheadings
  
  // Spacing (Tailwind-like spacing scale)
  const paragraphSpacing = 16; // 1rem = 16pt between paragraphs
  const headingTopMargin = 24; // 1.5rem = 24pt before heading
  const headingBottomMargin = 12; // 0.75rem = 12pt after heading
  const subHeadingTopMargin = 20; // 1.25rem = 20pt before subheading
  const subHeadingBottomMargin = 10; // ~0.625rem after subheading
  
  let yPosition = height - topMargin; // Start below top margin
  let currentPageIndex = 0;
  let imagesPlacedOnPage = new Set<number>(); // Track which pages already have images

  // CRITICAL: Split content intelligently to preserve structure
  // First, normalize the content
  let normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Split by double newlines first (standard paragraph breaks)
  let paragraphs = normalizedContent.split(/\n\n+/).filter(p => {
    const trimmed = p.trim();
    // Filter out empty paragraphs but keep headings even if they're single lines
    return trimmed.length > 0;
  });
  
  // If we have very few paragraphs, try splitting by single newlines but be smart about it
  if (paragraphs.length < 5) {
    // Re-split by single newlines, but group non-heading lines together
    const lines = normalizedContent.split('\n').filter(l => l.trim().length > 0);
    paragraphs = [];
    let currentParagraph = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const isHeading = line.match(/^#{1,3}\s/); // Check if line starts with # and space
      
      if (isHeading) {
        // If we have accumulated text, save it as a paragraph
        if (currentParagraph.trim().length > 0) {
          paragraphs.push(currentParagraph.trim());
          currentParagraph = '';
        }
        // Heading is its own paragraph
        paragraphs.push(line);
      } else {
        // Add line to current paragraph
        if (currentParagraph.length > 0) {
          currentParagraph += ' ' + line;
        } else {
          currentParagraph = line;
        }
      }
    }
    
    // Don't forget the last paragraph
    if (currentParagraph.trim().length > 0) {
      paragraphs.push(currentParagraph.trim());
    }
  }
  
  // If still no content, use the whole content as one paragraph
  if (paragraphs.length === 0 && content.trim().length > 0) {
    paragraphs = [content.trim()];
  }

  console.log(`[PDF Generation] Split into ${paragraphs.length} paragraphs, ${images.length} images to place`);
  
  // Log first few paragraphs for debugging
  if (paragraphs.length > 0) {
    console.log(`[PDF Generation] First 3 paragraphs preview:`);
    paragraphs.slice(0, 3).forEach((p, i) => {
      console.log(`  ${i + 1}: "${p.substring(0, 80)}${p.length > 80 ? '...' : ''}"`);
    });
  }

  // Helper function to check and place image for a specific page
  // CRITICAL: This is called when we REACH a page, not at start of loop
  const placeImageIfNeeded = async (pageIndex: number) => {
    if (imagesPlacedOnPage.has(pageIndex)) {
      // Already placed image on this page - skip
      return;
    }
    
    // Find image that should be placed on this page (0-indexed)
    const imageForPage = images.find(img => img.pageIndex === pageIndex);
    
    if (!imageForPage) {
      // No image for this page - that's fine, just return
      return;
    }
    
    console.log(`[PDF Generation] Attempting to place image on page ${pageIndex + 1} (0-indexed: ${pageIndex})`);
    
    try {
        const imageBytes = Buffer.from(imageForPage.base64, 'base64');
        
        // Try to embed as PNG first, then JPEG if that fails
        let image;
        try {
          image = await pdfDoc.embedPng(imageBytes);
        } catch (pngError) {
          try {
            image = await pdfDoc.embedJpg(imageBytes);
          } catch (jpgError) {
            console.warn(`Failed to embed image as PNG or JPEG for page ${pageIndex}:`, pngError, jpgError);
            image = null;
          }
        }
        
        if (image) {
            // Scale image to fit page width (leave margins)
            const maxImageWidth = width - (margin * 2);
            const maxImageHeight = height * 0.4; // Max 40% of page height
            
            let imageWidth = image.width;
            let imageHeight = image.height;
            
            // Scale down if too large
            if (imageWidth > maxImageWidth) {
              const scale = maxImageWidth / imageWidth;
              imageWidth *= scale;
              imageHeight *= scale;
            }
            if (imageHeight > maxImageHeight) {
              const scale = maxImageHeight / imageHeight;
              imageWidth *= scale;
              imageHeight *= scale;
            }
            
            // Ensure we have space for the image (check against bottom margin)
            if (yPosition - imageHeight - paragraphSpacing < bottomMargin) {
              // Need a new page for the image
              currentPage = pdfDoc.addPage([612, 792]);
              yPosition = height - topMargin;
              currentPageIndex++;
            }

            currentPage.drawImage(image, {
              x: margin + (maxImageWidth - imageWidth) / 2, // Center the image
              y: yPosition - imageHeight,
              width: imageWidth,
              height: imageHeight,
            });
            
            yPosition -= imageHeight + paragraphSpacing * 1.5; // Add extra space after image (1.5rem)
            imagesPlacedOnPage.add(pageIndex);
            console.log(`[PDF Generation] ✅ Successfully placed image on page ${currentPageIndex + 1} (target was page ${pageIndex + 1}, 0-indexed: ${pageIndex})`);
        } else {
          console.error(`[PDF Generation] ❌ Failed to embed image - image object is null for page ${pageIndex + 1}`);
        }
      } catch (error) {
        console.error(`[PDF Generation] ❌ Failed to embed image in PDF for page ${pageIndex + 1}:`, error);
      }
  };

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    
    // CRITICAL: Check for images when we actually REACH a new page, not at start of loop
    // This ensures images are placed at the correct page index

    // CRITICAL: Detect headings FIRST from original paragraph (before any cleaning)
    // Handle whitespace and edge cases
    const originalParagraph = paragraph.trim();
    
    // Improved heading detection - handles whitespace and various formats
    // Must start with # followed by space (e.g., "# Title" not "#Title")
    const trimmedStart = originalParagraph.replace(/^\s+/, ''); // Remove leading whitespace
    const headingMatch = trimmedStart.match(/^(#{1,3})\s+(.+)$/); // Match #, ##, or ### followed by space
    
    const isHeading = headingMatch && headingMatch[1] === '#';
    const isSubHeading = headingMatch && headingMatch[1] === '##';
    const isSubSubHeading = headingMatch && headingMatch[1] === '###';
    
    // Now remove ALL markdown symbols - they should NOT appear in final PDF
    let cleanedParagraph = originalParagraph;
    
    // If it's a heading, extract just the title part (after # symbols)
    if (headingMatch && headingMatch[2]) {
      // Extract title from heading (everything after "# Title: " or just "# Title")
      cleanedParagraph = headingMatch[2].trim();
    } else {
      // Not a heading - remove all markdown symbols
      // Remove ALL # symbols (they've been detected, now remove them)
      cleanedParagraph = cleanedParagraph.replace(/^#+\s*/gm, ''); // Remove # at start of line (multiline)
      cleanedParagraph = cleanedParagraph.replace(/#+/g, ''); // Remove any remaining # symbols anywhere
    }
    
    // Always remove other markdown symbols
    cleanedParagraph = cleanedParagraph.replace(/\*\*/g, ''); // Remove bold **
    cleanedParagraph = cleanedParagraph.replace(/__/g, ''); // Remove bold __
    cleanedParagraph = cleanedParagraph.replace(/\*/g, ''); // Remove italics *
    cleanedParagraph = cleanedParagraph.replace(/_/g, ' '); // Replace _ with space (not empty!)
    
    // Use cleaned text for rendering (NO markdown symbols should remain)
    let textToRender = cleanedParagraph.trim();
    
    // Replace newlines with spaces for PDF rendering (WinAnsi can't encode newlines directly)
    textToRender = textToRender.replace(/\n/g, ' ').replace(/\r/g, '');
    // Clean up multiple spaces
    textToRender = textToRender.replace(/\s+/g, ' ').trim();
    
    if (!textToRender) continue; // Skip empty paragraphs
    
    // CRITICAL VALIDATION: Ensure NO markdown symbols remain in the text
    if (textToRender.includes('#') || textToRender.includes('**') || textToRender.includes('__')) {
      console.error(`[PDF Generation] ❌ ERROR: Markdown symbols STILL detected after cleaning: "${textToRender.substring(0, 100)}"`);
      // Force remove any remaining markdown - this should never happen but safety check
      textToRender = textToRender.replace(/#+/g, '').replace(/\*\*/g, '').replace(/__/g, '').replace(/\*/g, '').trim();
      if (textToRender.includes('#')) {
        console.error(`[PDF Generation] ❌ CRITICAL: Failed to remove # symbols! Text: "${textToRender.substring(0, 50)}"`);
      }
    }
    
    // Add spacing before headings (but not on first paragraph of page)
    if ((isHeading || isSubHeading || isSubSubHeading) && i > 0) {
      const topSpacing = isHeading ? headingTopMargin : (isSubHeading || isSubSubHeading) ? subHeadingTopMargin : 0;
      // Check if we need a new page before adding heading spacing
      if (yPosition - topSpacing < bottomMargin + bodyLineHeight) {
        currentPage = pdfDoc.addPage([612, 792]);
        yPosition = height - topMargin;
        currentPageIndex++;
        // CRITICAL: Place image when we REACH a new page (not at start of loop)
        await placeImageIfNeeded(currentPageIndex);
      } else if (topSpacing > 0) {
        yPosition -= topSpacing; // Add top margin for heading
      }
    }
    
    // Check if we need a new page before drawing content
    const requiredLineHeight = isHeading ? headingLineHeight : isSubHeading ? subHeadingLineHeight : bodyLineHeight;
    if (yPosition - requiredLineHeight < bottomMargin) {
      currentPage = pdfDoc.addPage([612, 792]);
      yPosition = height - topMargin;
      currentPageIndex++;
      // CRITICAL: Place image when we REACH a new page (not at start of loop)
      await placeImageIfNeeded(currentPageIndex);
    }
    
    // Use regular font for all text, bold only for headings
    // IMPORTANT: Only headings get bold - body text must be regular font
    const textFont = font; // Always use regular font - bold is set separately for headings
    // Determine font size: heading > subheading > sub-subheading > body
    let textSize = fontSize;
    if (isHeading) {
      textSize = headingFontSize; // 18pt for main headings
    } else if (isSubHeading) {
      textSize = subHeadingFontSize; // 16pt for subheadings
    } else if (isSubSubHeading) {
      textSize = 14; // 14pt for sub-subheadings
    } else {
      textSize = fontSize; // 12pt for body text
    }
    
    const lineHeight = isHeading ? headingLineHeight : isSubHeading ? subHeadingLineHeight : bodyLineHeight;

    const words = textToRender.split(' ').filter(w => w.trim().length > 0);
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      // Remove any remaining special characters that might cause issues
      const cleanTestLine = testLine.replace(/[\r\n\t]/g, ' ');
      // Use correct font for width calculation
      const fontForWidth = (isHeading || isSubHeading || isSubSubHeading) ? helveticaBold : font;
      const textWidth = fontForWidth.widthOfTextAtSize(cleanTestLine, textSize);

        if (textWidth > width - (margin * 2)) {
        if (currentLine) {
          // Clean currentLine before drawing (remove any newlines or special chars)
          const cleanLine = currentLine.replace(/[\r\n\t]/g, ' ').trim();
          if (cleanLine) {
            // Draw text with proper formatting: bold ONLY for headings, regular for body
            // CRITICAL: Body text must use regular font, not bold
            const fontToUse = (isHeading || isSubHeading || isSubSubHeading) ? helveticaBold : font;
            currentPage.drawText(cleanLine, {
              x: margin,
              y: yPosition,
              size: textSize,
              font: fontToUse,
              color: rgb(0, 0, 0),
            });
            yPosition -= lineHeight; // Use appropriate line height for text type
          }
          
          // Check if we need a new page before next line
          if (yPosition - lineHeight < bottomMargin) {
            currentPage = pdfDoc.addPage([612, 792]);
            yPosition = height - topMargin;
            currentPageIndex++;
            // CRITICAL: Place image when we REACH a new page
            await placeImageIfNeeded(currentPageIndex);
          }
        }
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }

    if (currentLine) {
      // Clean currentLine before drawing (remove any newlines or special chars)
      const cleanLine = currentLine.replace(/[\r\n\t]/g, ' ').trim();
      if (cleanLine) {
        // Draw text with proper formatting: bold ONLY for headings, regular for body
        // CRITICAL: Body text must use regular font, not bold
        const fontToUse = (isHeading || isSubHeading || isSubSubHeading) ? helveticaBold : font;
        currentPage.drawText(cleanLine, {
          x: margin,
          y: yPosition,
          size: textSize,
          font: fontToUse,
          color: rgb(0, 0, 0),
        });
        
        // Add spacing after paragraph (more for headings)
        const bottomSpacing = isHeading ? headingBottomMargin : (isSubHeading || isSubSubHeading) ? subHeadingBottomMargin : paragraphSpacing;
        yPosition -= lineHeight + bottomSpacing;
      }
    }
    
    // No need for extra image placement logic - images are placed at page start
  }

  const pdfBytes = await pdfDoc.save();
  console.log(`[PDF Generation] Complete: ${currentPageIndex + 1} pages, ${imagesPlacedOnPage.size} images placed`);
  console.log(`[PDF Generation] Formatting: 12pt body text (regular font), 18pt headings (bold), proper spacing applied`);
  
  if (imagesPlacedOnPage.size === 0 && images.length > 0) {
    console.error(`[PDF Generation] ❌ WARNING: ${images.length} images were generated but NONE were placed in PDF!`);
    console.error(`[PDF Generation] Check image placement logic and page index matching`);
  }
  
  return Buffer.from(pdfBytes);
}

async function generateWhitepaperDOCX(
  content: string,
  images: Array<{ pageIndex: number; base64: string }>,
  numPages: number
): Promise<Buffer> {
  const children: Paragraph[] = [];
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  let estimatedPageIndex = 0;
  let paragraphIndex = 0; // Track current paragraph index
  const imagesPlaced = new Set<number>();
  
  // Rough estimation: ~50 paragraphs per page
  const paragraphsPerPage = 50;

  for (let i = 0; i < paragraphs.length; i++) {
    const paragraph = paragraphs[i];
    const currentEstimatedPage = Math.floor(i / paragraphsPerPage);

    // Place image at the start of target pages
    images.forEach(img => {
      if (img.pageIndex === currentEstimatedPage && !imagesPlaced.has(img.pageIndex)) {
        try {
          const imageBuffer = Buffer.from(img.base64, 'base64');
          // Add text placeholder - DOCX image embedding requires Media API setup
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `[Image ${img.pageIndex + 1}: Visual representation - ${img.pageIndex * 100 + 50}px wide]`,
                  italics: true,
                  color: '666666',
                  size: 20,
                }),
              ],
              alignment: AlignmentType.CENTER,
              spacing: { before: 200, after: 200 },
            })
          );
          imagesPlaced.add(img.pageIndex);
          console.log(`✅ Added image placeholder to DOCX for page ${img.pageIndex}`);
        } catch (error) {
          console.warn(`Failed to add image placeholder in DOCX for page ${img.pageIndex}:`, error);
        }
      }
    });

    // Remove markdown formatting from paragraph
    let cleanParagraph = paragraph.replace(/\*\*/g, ''); // Remove bold **
    cleanParagraph = cleanParagraph.replace(/__/g, ''); // Remove bold __
    cleanParagraph = cleanParagraph.replace(/\*/g, ''); // Remove italics *
    cleanParagraph = cleanParagraph.replace(/_/g, ' '); // Replace _ with space
    
    // Handle headings
    const isHeading = cleanParagraph.trim().startsWith('#');
    const isSubHeading = cleanParagraph.trim().startsWith('##');
    const textToRender = cleanParagraph.replace(/^#+\s*/, '');

    children.push(
      new Paragraph({
          children: [
            new TextRun({
              text: textToRender,
              bold: isHeading || isSubHeading, // Bold only for headings
              size: isHeading ? 18 : isSubHeading ? 16 : 12, // 18pt for headings, 12pt for body
            }),
          ],
        heading: isHeading ? HeadingLevel.HEADING_1 : isSubHeading ? HeadingLevel.HEADING_2 : undefined,
        spacing: { after: isHeading ? 200 : 100 },
      })
    );

    paragraphIndex++;
    // Rough estimate: every 50 paragraphs ≈ 1 page
    if (paragraphIndex > 50) {
      estimatedPageIndex++;
      paragraphIndex = 0;
    }
  }

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });

  return await Packer.toBuffer(doc);
}

async function generateWhitepaperPPT(
  content: string,
  images: Array<{ pageIndex: number; base64: string }>,
  numSlides: number
): Promise<Buffer> {
  const pptx = new PptxGenJS();
  
  // Set presentation properties
  pptx.layout = 'LAYOUT_WIDE';
  
  const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0);
  let currentSlideIndex = 0;
  let slide = pptx.addSlide();
  const imagesPlaced = new Set<number>();
  
  // Title slide
  const firstHeading = paragraphs.find(p => p.trim().startsWith('#'));
  if (firstHeading) {
    slide.addText(firstHeading.replace(/^#+\s*/, ''), {
      x: 0.5,
      y: 1.5,
      w: 9,
      h: 1.5,
      fontSize: 44,
      bold: true,
      align: 'center',
    });
  }
  
  currentSlideIndex++;

  for (let i = 0; i < paragraphs.length && currentSlideIndex < numSlides; i++) {
    const paragraph = paragraphs[i];
    
    if (paragraph.trim().startsWith('#') && currentSlideIndex > 0) {
      // New slide for new heading
      slide = pptx.addSlide();
      currentSlideIndex++;
    }

    // Add image if needed for this slide (map page index to slide index)
    const imageForSlide = images.find(img => {
      // Map page index to slide index (they should align closely)
      const targetSlide = img.pageIndex + 1; // +1 because first slide is title
      return targetSlide === currentSlideIndex && !imagesPlaced.has(img.pageIndex);
    });
    
    if (imageForSlide && !imagesPlaced.has(imageForSlide.pageIndex)) {
      try {
        slide.addImage({
          data: `data:image/png;base64,${imageForSlide.base64}`,
          x: 1,
          y: 2,
          w: 8,
          h: 4.5,
        });
        imagesPlaced.add(imageForSlide.pageIndex);
        console.log(`✅ Placed image in PPT on slide ${currentSlideIndex} (target was page ${imageForSlide.pageIndex})`);
      } catch (error) {
        console.warn(`Failed to embed image in PPT on slide ${currentSlideIndex}:`, error);
      }
    }

    // Remove markdown formatting
    let cleanParagraph = paragraph.replace(/\*\*/g, ''); // Remove bold **
    cleanParagraph = cleanParagraph.replace(/__/g, ''); // Remove bold __
    cleanParagraph = cleanParagraph.replace(/\*/g, ''); // Remove italics *
    cleanParagraph = cleanParagraph.replace(/_/g, ' '); // Replace _ with space
    
    const isHeading = cleanParagraph.trim().startsWith('#');
    const isSubHeading = cleanParagraph.trim().startsWith('##');
    const textToRender = cleanParagraph.replace(/^#+\s*/, '').substring(0, 500); // Limit text length per slide

    if (textToRender.trim()) {
      slide.addText(textToRender, {
        x: 0.5,
        y: imageForSlide ? 6.5 : (isHeading ? 1.5 : 2),
        w: 9,
        h: imageForSlide ? 2 : 4,
        fontSize: isHeading ? 18 : isSubHeading ? 16 : 12, // 18pt for headings, 12pt for body
        bold: isHeading || isSubHeading, // Bold only for headings
        wrap: true,
      });
    }
  }

  // Generate PPTX buffer
  const buffer = await pptx.write({ outputType: 'nodebuffer' });
  return buffer as Buffer;
}

export async function POST(request: NextRequest) {
  try {
    console.log('[Whitepaper API] Request received');
    
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      console.error('[Whitepaper API] Failed to parse request body:', jsonError);
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    
    const { prompt, outputFormat = 'pdf', numPages, imageFrequency, writingStyle, frameworks = [] } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    // Query vector database for relevant context
    const queryEmbedding = await getEmbedding(prompt);
    let allMatches: any[] = [];

    // Query for main prompt
    try {
      const mainMatches = await queryPinecone(queryEmbedding, 10);
      allMatches.push(...mainMatches);
    } catch (error) {
      console.warn('Pinecone query failed for main prompt:', error);
    }

    // Query for each selected framework separately to get framework-specific content
    const frameworkContexts: Record<string, string> = {};
    for (const frameworkId of frameworks) {
      const frameworkQuery = frameworkQueries[frameworkId];
      if (frameworkQuery) {
        try {
          const frameworkEmbedding = await getEmbedding(frameworkQuery);
          const frameworkMatches = await queryPinecone(frameworkEmbedding, 10);
          
          // Build context for this specific framework
          const frameworkContext = frameworkMatches
            .slice(0, 5)
            .map((match) => {
              const metadata = match.metadata || {};
              return `${metadata.text || match.id}`;
            })
            .join('\n\n');
          
          if (frameworkContext) {
            frameworkContexts[frameworkId] = frameworkContext;
          }
          
          allMatches.push(...frameworkMatches);
        } catch (error) {
          console.warn(`Pinecone query failed for framework ${frameworkId}:`, error);
        }
      }
    }

    // Deduplicate matches by id
    const uniqueMatches = Array.from(
      new Map(allMatches.map(match => [match.id, match])).values()
    );

    // Build general context from matches (prioritize higher scores)
    const sortedMatches = uniqueMatches.sort((a, b) => (b.score || 0) - (a.score || 0));
    const context = sortedMatches
      .slice(0, 30) // Increase to 30 for more context
      .map((match) => {
        const metadata = match.metadata || {};
        return `[${metadata.title || 'Document'}]: ${metadata.text || match.id}`;
      })
      .join('\n\n');

    // Build whitepaper generation prompt with framework names
    const frameworkNames = frameworks
      .map(id => {
        const framework = Object.keys(frameworkQueries).find(f => f === id);
        return framework ? framework.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : null;
      })
      .filter(Boolean)
      .join(', ');

    // Build framework-specific instructions
    let frameworkInstructions = '';
    if (frameworks.length > 0) {
      frameworkInstructions = `\n\nCRITICAL: The following frameworks MUST be included as dedicated sections in the whitepaper:\n${frameworks.map((id, idx) => {
        const frameworkName = Object.keys(frameworkQueries).find(f => f === id);
        const name = frameworkName ? frameworkName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : id;
        return `${idx + 1}. ${name} - Create a dedicated section using the framework-specific content provided below.`;
      }).join('\n')}\n\nFor each framework, use the framework-specific content provided to create a comprehensive analysis section.`;
    }

    // Calculate minimum word count requirement (500 words per page, with 10% buffer)
    const minWords = Math.round(numPages * 500 * 1.1); // 10% buffer
    const targetWords = numPages * 500;
    
    // Calculate minimum words per section
    const execSummaryWords = Math.round(targetWords * 0.15);
    const mainContentWords = Math.round(targetWords * 0.30);
    const frameworkWordsPerFramework = frameworks.length > 0 ? Math.round(targetWords * 0.40 / frameworks.length) : 0;
    const synthesisWords = Math.round(targetWords * 0.15);
    const conclusionWords = Math.round(targetWords * 0.10);

    const systemPrompt = `You are a professional whitepaper writer. Your output will be directly converted to PDF format. You MUST follow ALL formatting rules exactly - there is NO markdown rendering. Your text goes directly to a PDF generator.

CRITICAL UNDERSTANDING: 
- Your output is NOT markdown - it's plain text that will be formatted by a PDF generator
- The generator will detect # headings and convert them to bold text
- ALL other markdown symbols (**, __, *, _) will be STRIPPED and look broken in the PDF
- Write ONLY plain text with proper punctuation - NO formatting symbols

Generate a comprehensive, high-quality whitepaper with the following MANDATORY specifications:

CRITICAL LENGTH REQUIREMENT (MUST BE FOLLOWED EXACTLY): 
- You MUST generate EXACTLY ${numPages} pages of content (approximately ${targetWords} words, minimum ${minWords} words)
- This is NOT a suggestion - it is a HARD REQUIREMENT that MUST be met
- If your response is shorter than ${minWords} words, the document will be incomplete and you will have FAILED
- Each page should contain approximately 500 words
- You MUST continue writing until you reach the full ${numPages} pages
- DO NOT stop early - keep writing until you reach ${minWords} words minimum

MANDATORY WRITING STYLE REQUIREMENTS (MUST BE FOLLOWED EXACTLY):
${writingStylePrompts[writingStyle]}

CRITICAL: You MUST strictly follow the writing style specified above. Every sentence, paragraph, and section must adhere to this style. Do not deviate from these style guidelines.

Frameworks to Include: ${frameworkNames || 'None specified - use general structure'}${frameworkInstructions}

MANDATORY STRUCTURE WITH WORD COUNT REQUIREMENTS:
1. Executive Summary / Introduction: Minimum ${execSummaryWords} words (15% of total)
   - Provide comprehensive overview of the topic
   - Set context and importance
   - Outline key findings and structure

2. Main Content Sections: Minimum ${mainContentWords} words total (30% of total)
   - Develop the core topic with multiple subsections
   - Provide detailed analysis and discussion
   - Use knowledge base content extensively

3. Framework Analysis Sections: ${frameworks.length > 0 ? `For EACH selected framework, create a dedicated section with minimum ${frameworkWordsPerFramework} words per framework (40% total, ${frameworkWordsPerFramework} words each).` : 'N/A'}
   - Use the framework-specific content provided to create detailed analysis
   - Apply framework methodology thoroughly
   - Include examples and case studies
   - ${frameworks.length > 0 ? `You have ${frameworks.length} framework(s), so allocate approximately ${frameworkWordsPerFramework} words to each.` : ''}

4. Synthesis and Integration: Minimum ${synthesisWords} words (15% of total)
   - Integrate findings from all sections
   - Show connections between frameworks and main content
   - Provide comprehensive synthesis

5. Conclusions and Recommendations: Minimum ${conclusionWords} words (10% of total)
   - Summarize key findings
   - Provide actionable recommendations
   - Discuss implications and future directions

CONTENT QUALITY REQUIREMENTS:
- Write in-depth, analytical content - avoid superficial descriptions
- Use specific examples, data points, and evidence from the knowledge base
- For each framework section, provide detailed analysis using the framework-specific content provided
- Include concrete examples and case studies from the research content
- Write substantive paragraphs (100-200 words each)
- Ensure logical flow between sections with transition sentences
- FILL ALL ${numPages} PAGES - do not stop early

CRITICAL FORMATTING RULES - THESE ARE MANDATORY AND WILL BE ENFORCED:

1. HEADINGS - Use ONLY these patterns (system will convert to bold formatting):
   - Main sections: Start line with "# " followed by title (e.g., "# Executive Summary")
   - Subsections: Start line with "## " followed by title (e.g., "## Market Overview")
   - Sub-subsections: Start line with "### " followed by title
   - Each heading MUST be on its own line with blank lines before and after
   - DO NOT put text on the same line as a heading

2. PARAGRAPHS - Formatting requirements:
   - Each paragraph MUST be separated by a blank line (double newline)
   - Each paragraph should be 3-6 sentences (100-200 words)
   - DO NOT create walls of text - break into multiple paragraphs
   - Start each paragraph on a new line
   - DO NOT use bullet points or lists unless explicitly required

3. TEXT FORMATTING - STRICTLY PROHIBITED:
   - DO NOT use markdown bold (**text**) - just write normal text
   - DO NOT use markdown italics (*text* or _text_) - just write normal text
   - DO NOT use any other markdown symbols (**, __, *, _)
   - Write ONLY plain text with proper capitalization and punctuation

4. STRUCTURE ENFORCEMENT:
   - Headings MUST appear at the start of sections
   - Each major section must have clear heading followed by 3-4 paragraphs minimum
   - Use consistent paragraph length throughout
   - Maintain professional document structure

5. WRITING STYLE ENFORCEMENT - THIS IS MANDATORY:
   - Writing style: "${writingStyle}"
   - Style requirements: ${writingStyle === 'easy-read' ? 'High school reading level, conversational tone, simple language, explain technical terms, make concepts accessible to everyone' : writingStyle === 'professional' ? 'Researcher perspective, expert terminology, academic tone, use specialist terms appropriately, maintain scholarly rigor' : 'Executive summary style, point-by-point format, business value focus, actionable insights, strategic implications'}
   - EVERY SINGLE SENTENCE must follow this style - no exceptions
   - If you deviate from the style, the document will be rejected

6. OUTPUT VALIDATION:
   - Your output will be automatically checked for formatting compliance
   - Any markdown symbols (except # for headings) will be removed
   - Headings will be converted to bold text automatically
   - Body text will be 12pt regular font - NO bold, NO italics
   - Non-compliance will result in document rejection

REMEMBER: You MUST generate at least ${minWords} words (${numPages} pages). This is a hard requirement. Continue writing until you reach this target.`;

    // Build user message with structured context
    let userMessage = `Generate a comprehensive whitepaper on: ${prompt}\n\n`;
    
    // Add general context
    if (context) {
      userMessage += `GENERAL KNOWLEDGE BASE CONTEXT:\n${context}\n\n`;
    }
    
    // Add framework-specific contexts
    if (Object.keys(frameworkContexts).length > 0) {
      userMessage += `FRAMEWORK-SPECIFIC CONTENT (USE THIS CONTENT FOR THE CORRESPONDING FRAMEWORK SECTIONS):\n\n`;
      for (const [frameworkId, frameworkContext] of Object.entries(frameworkContexts)) {
        const frameworkName = Object.keys(frameworkQueries).find(f => f === frameworkId);
        const name = frameworkName ? frameworkName.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : frameworkId;
        userMessage += `--- ${name} Framework Content ---\n${frameworkContext}\n\n`;
      }
    }
    
    userMessage += `\n\nCRITICAL OUTPUT REQUIREMENTS - READ CAREFULLY:

1. FORMATTING: Use ONLY # symbols for headings. NO other markdown symbols allowed.
2. STYLE: Apply the "${writingStyle}" writing style to EVERY sentence - no exceptions.
3. STRUCTURE: Follow the mandatory structure with proper headings and paragraphs.
4. LENGTH: Generate at least ${minWords} words (${numPages} pages) - do not stop early.
5. QUALITY: Write substantial, detailed content - avoid superficial descriptions.

Your output will be processed by a PDF generator that:
- Converts # headings to 18pt bold text
- Formats body text as 12pt regular font
- Removes ALL other markdown symbols
- Validates formatting compliance

Ensure your output follows ALL these requirements. Non-compliance will result in a poorly formatted document.`;

    // Generate whitepaper content
    console.log(`[Whitepaper API] Starting whitepaper generation for ${numPages} pages`);
    console.log(`[Whitepaper API] System prompt length: ${systemPrompt.length} characters`);
    console.log(`[Whitepaper API] User message length: ${userMessage.length} characters`);
    
      // Calculate max tokens based on number of pages
      // Approximately 500 words per page = ~750 tokens per page
      // But we need to account for response tokens, so use ~1100 tokens per page for output
      const tokensPerPage = 1100; // Slightly more than needed (750 tokens = 500 words, so 1100 = ~730 words)
      const estimatedTokens = numPages * tokensPerPage;
      // Ensure we have enough tokens: minimum 4000, but scale with page count
      const minTokens = Math.max(4000, numPages * 750); // At least 750 tokens per page minimum
      // For large documents (>30 pages), we need chunked generation since model limit is 16k tokens
      const maxTokensPerRequest = 16384; // Model limit
      const needsChunking = estimatedTokens > maxTokensPerRequest;
      const maxTokens = needsChunking ? maxTokensPerRequest : Math.min(Math.max(estimatedTokens, minTokens), maxTokensPerRequest);
      
      console.log(`[Whitepaper API] Token calculation: ${numPages} pages = ${estimatedTokens} tokens (min: ${minTokens}, max: ${maxTokens})`);
      console.log(`[Whitepaper API] Target word count: ${targetWords} words (minimum: ${minWords})`);
      if (needsChunking) {
        console.log(`[Whitepaper API] ⚠️ Document is large (${numPages} pages) - will use chunked generation`);
      }
      
      // Define minimum words required for validation (allow 20% tolerance)
      const minWordsRequired = Math.round(numPages * 500 * 0.8);
    
    let whitepaperContent: string;
    try {
      console.log(`[Whitepaper API] Calling OpenAI with max_tokens=${maxTokens} (for ${numPages} pages)`);
      
            // Use lower temperature for more consistent, rule-following output
            // Higher temperature = more creative but less compliant
            whitepaperContent = await chatCompletion(
              [
                { role: 'system' as const, content: systemPrompt },
                { role: 'user' as const, content: userMessage }
              ],
              undefined, // Don't add default context, we're providing system message
              { 
                temperature: 0.5, // Lower temperature for better rule compliance (was 0.7)
                preserveSystemMessage: true,
                maxTokens: maxTokens // This is critical - must be high enough for full length
              }
            );

      console.log(`[Whitepaper API] Initial generation complete. Length: ${whitepaperContent?.length || 0} characters`);
      
      if (whitepaperContent) {
        const initialWords = whitepaperContent.trim().split(/\s+/).length;
        console.log(`[Whitepaper API] Initial generation: ${initialWords} words`);
        console.log(`Content preview (first 500 chars): ${whitepaperContent.substring(0, 500)}`);
        
        // If content is too short or document is large, get continuations until we reach target
        let currentWords = initialWords;
        let continuationRound = 0;
        const maxContinuationRounds = 10; // Prevent infinite loops
        
        while (currentWords < minWordsRequired && continuationRound < maxContinuationRounds) {
          const wordsNeeded = minWordsRequired - currentWords;
          const remainingTokens = Math.max(4000, maxTokens - Math.round(currentWords * 1.5));
          
          console.warn(`[Whitepaper API] ⚠️ Round ${continuationRound + 1}: Content is ${currentWords} words, need ${minWordsRequired} words (${wordsNeeded} more needed). Requesting continuation...`);
          
          try {
            const continuationPrompt = `CRITICAL: Continue the whitepaper immediately. You currently have approximately ${currentWords} words but MUST reach at least ${minWordsRequired} words (${numPages} pages total). 

You need to add approximately ${wordsNeeded} more words. Continue writing from where you left off. Do NOT summarize what you've written - continue adding substantial, detailed content following the same structure and writing style. Keep the same depth and quality. Continue until you reach the full length requirement.`;
            
            const continuation = await chatCompletion(
              [
                { role: 'system' as const, content: systemPrompt },
                { role: 'user' as const, content: userMessage },
                { role: 'assistant' as const, content: whitepaperContent },
                { role: 'user' as const, content: continuationPrompt }
              ],
              undefined,
              { 
                temperature: 0.5, // Lower temperature for better rule compliance
                preserveSystemMessage: true,
                maxTokens: remainingTokens
              }
            );
            
            if (continuation && continuation.trim().length > 0) {
              whitepaperContent += '\n\n' + continuation;
              currentWords = whitepaperContent.trim().split(/\s+/).length;
              console.log(`[Whitepaper API] After round ${continuationRound + 1}: ${currentWords} words`);
              
              // If we've added substantial content, continue
              if (currentWords >= minWordsRequired) {
                console.log(`[Whitepaper API] ✅ Reached target word count: ${currentWords} words`);
                break;
              }
            } else {
              console.warn(`[Whitepaper API] Continuation round ${continuationRound + 1} returned empty content`);
              break; // Stop if continuation is empty
            }
          } catch (continuationError) {
            console.error(`[Whitepaper API] Failed to get continuation round ${continuationRound + 1}:`, continuationError);
            break; // Stop on error
          }
          
          continuationRound++;
        }
        
        if (currentWords < minWordsRequired) {
          console.error(`[Whitepaper API] ⚠️ WARNING: After ${continuationRound} continuation rounds, only generated ${currentWords} words (target: ${minWordsRequired})`);
        }
      }
    } catch (error) {
      console.error('Error during chatCompletion:', error);
      return NextResponse.json(
        { 
          error: 'Failed to generate whitepaper content', 
          details: error instanceof Error ? error.message : 'Unknown error',
          hint: 'Check server logs for more details'
        },
        { status: 500 }
      );
    }

    // Validate content was generated
    if (!whitepaperContent || whitepaperContent.trim().length === 0) {
      console.error('Whitepaper content is empty after generation');
      console.error('Response type:', typeof whitepaperContent);
      console.error('Response value:', whitepaperContent);
      
      return NextResponse.json(
        { 
          error: 'Failed to generate whitepaper content. The AI response was empty.',
          hint: 'This might be due to API rate limits, invalid API key, or the model not generating content. Check server logs for details.'
        },
        { status: 500 }
      );
    }

    // Validate content length meets requirements
    const contentWords = whitepaperContent.trim().split(/\s+/).length;
    const estimatedPages = Math.round(contentWords / 500);
    
    console.log(`[Whitepaper API] Generated whitepaper content:`);
    console.log(`  - Length: ${whitepaperContent.length} characters`);
    console.log(`  - Word count: ${contentWords} words`);
    console.log(`  - Estimated pages: ${estimatedPages} (target: ${numPages})`);
    console.log(`  - Minimum required: ${minWordsRequired} words`);
    
    if (contentWords < minWordsRequired) {
      console.warn(`[Whitepaper API] ⚠️ WARNING: Generated content (${contentWords} words) is shorter than required minimum (${minWordsRequired} words)`);
      console.warn(`[Whitepaper API] This may result in fewer pages than requested (${estimatedPages} pages vs ${numPages} requested)`);
    }
    
    console.log(`Content preview: ${whitepaperContent.substring(0, 200)}...`);

    // CRITICAL POST-PROCESSING: Clean AI output to ensure compliance
    console.log(`[Whitepaper API] Post-processing AI output to enforce formatting rules...`);
    
    // Step 1: Normalize line breaks and spacing
    whitepaperContent = whitepaperContent.replace(/\r\n/g, '\n'); // Normalize line breaks
    whitepaperContent = whitepaperContent.replace(/\r/g, '\n');
    
    // Step 2: Fix common AI formatting mistakes
    // Remove markdown bold/italics (shouldn't be there but AI sometimes adds them)
    whitepaperContent = whitepaperContent.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove **bold**
    whitepaperContent = whitepaperContent.replace(/\*([^*]+)\*/g, '$1'); // Remove *italic*
    whitepaperContent = whitepaperContent.replace(/__([^_]+)__/g, '$1'); // Remove __bold__
    whitepaperContent = whitepaperContent.replace(/_([^_]+)_/g, '$1'); // Remove _italic_
    whitepaperContent = whitepaperContent.replace(/\*\*/g, ''); // Remove any remaining **
    whitepaperContent = whitepaperContent.replace(/__/g, ''); // Remove any remaining __
    whitepaperContent = whitepaperContent.replace(/\*/g, ''); // Remove any remaining *
    whitepaperContent = whitepaperContent.replace(/_/g, ' '); // Replace _ with space
    
    // Step 3: Ensure proper paragraph spacing (double newlines)
    whitepaperContent = whitepaperContent.replace(/\n{3,}/g, '\n\n'); // Max 2 newlines
    whitepaperContent = whitepaperContent.replace(/\n\s+\n/g, '\n\n'); // Remove spaces between paragraphs
    
    // Step 4: Clean up heading formatting
    // Ensure headings are properly formatted (single # on their own line)
    whitepaperContent = whitepaperContent.replace(/^###\s*(.+)$/gm, '### $1'); // Ensure space after ###
    whitepaperContent = whitepaperContent.replace(/^##\s*(.+)$/gm, '## $1'); // Ensure space after ##
    whitepaperContent = whitepaperContent.replace(/^#\s*(.+)$/gm, '# $1'); // Ensure space after #
    
    // Step 5: Remove any text on same line as heading (common AI mistake)
    whitepaperContent = whitepaperContent.replace(/^(#{1,3}\s+[^\n]+)\s+(.+)$/gm, '$1\n\n$2');
    
    // Step 6: Ensure headings have blank lines before and after
    whitepaperContent = whitepaperContent.replace(/([^\n])\n(#{1,3}\s)/g, '$1\n\n$2'); // Blank line before heading
    whitepaperContent = whitepaperContent.replace(/(#{1,3}\s[^\n]+)\n([^\n])/g, '$1\n\n$2'); // Blank line after heading
    
    // Step 7: Final validation - check for rule violations
    const markdownBold = (whitepaperContent.match(/\*\*/g) || []).length;
    const markdownBoldAlt = (whitepaperContent.match(/__/g) || []).length;
    const markdownItalic = (whitepaperContent.match(/\*[^*]/g) || []).length;
    const headingCount = (whitepaperContent.match(/^#{1,3}\s/gm) || []).length;
    const paragraphCount = whitepaperContent.split(/\n\n+/).filter(p => p.trim().length > 0).length;
    
    const markdownViolations = markdownBold + markdownBoldAlt + markdownItalic;
    
    console.log(`[Whitepaper API] Post-processing validation:`);
    console.log(`  - Content length: ${whitepaperContent.length} chars`);
    console.log(`  - Headings found: ${headingCount}`);
    console.log(`  - Paragraphs found: ${paragraphCount}`);
    console.log(`  - Markdown violations: ${markdownViolations} (will be removed)`);
    
    if (markdownViolations > 10) {
      console.error(`[Whitepaper API] ❌ CRITICAL: Found ${markdownViolations} markdown violations - AI did not follow formatting rules!`);
      console.error(`[Whitepaper API] Content will be cleaned but may have formatting issues`);
    } else if (markdownViolations > 0) {
      console.warn(`[Whitepaper API] ⚠️ WARNING: Found ${markdownViolations} markdown violations - cleaning now`);
    }
    
    if (headingCount < 3) {
      console.warn(`[Whitepaper API] ⚠️ WARNING: Only ${headingCount} headings found - document may lack structure`);
    }
    
    if (paragraphCount < 10) {
      console.warn(`[Whitepaper API] ⚠️ WARNING: Only ${paragraphCount} paragraphs found - document may be poorly structured`);
    }
    
    // IMPORTANT: We keep # symbols temporarily so PDF generator can detect headings
    // The PDF generator will remove them during rendering after detection

    // Parse image frequency (e.g., "1 image per 3 pages")
    const imageMatch = imageFrequency && typeof imageFrequency === 'string' 
      ? imageFrequency.match(/(\d+)\s*image.*?per\s*(\d+)/i) 
      : null;
    const imagesPerCount = imageMatch ? parseInt(imageMatch[1]) : 0;
    const pagesPerImage = imageMatch ? parseInt(imageMatch[2]) : 0;

    // Calculate where to place images
    const images: Array<{ pageIndex: number; base64: string }> = [];
    
    console.log(`[Whitepaper API] Image frequency parse: "${imageFrequency}"`);
    console.log(`[Whitepaper API] Parsed: ${imagesPerCount} image(s) per ${pagesPerImage} page(s)`);
    
    if (imagesPerCount > 0 && pagesPerImage > 0) {
      const totalPages = outputFormat === 'ppt' ? Math.min(numPages, 50) : Math.min(numPages, 50);
      
      // Calculate total number of images needed
      // For "1 image per 2 pages" on 15 pages: we need images at pages 0, 2, 4, 6, 8, 10, 12, 14 (0-indexed)
      // That's Math.floor(15/2) = 7 images (at pages 2, 4, 6, 8, 10, 12, 14 - but we want to start from page 1)
      // Actually, we should place images at: page 1 (after first page), page 3, page 5, etc.
      // So for "1 image per 2 pages", we place at: 1, 3, 5, 7, 9, 11, 13 (0-indexed: 0, 2, 4, 6, 8, 10, 12)
      
      const numberOfImageGroups = Math.floor(totalPages / pagesPerImage);
      const totalImages = numberOfImageGroups * imagesPerCount;
      
      console.log(`[Whitepaper API] Target: ${totalPages} pages`);
      console.log(`[Whitepaper API] Will generate ${totalImages} image(s) (${numberOfImageGroups} groups × ${imagesPerCount} images per group)`);
      
      let imageCounter = 0;
      
      // Place images at the specified intervals
      // For "1 image per 2 pages", we want images at pages 2, 4, 6, 8, etc.
      // 0-indexed: pages 1, 3, 5, 7, etc. (after every N pages)
      for (let groupIndex = 0; groupIndex < numberOfImageGroups; groupIndex++) {
        // Calculate the page index for this group (0-indexed)
        // For "1 image per 2 pages": 
        //   group 0 = page 2 (0-indexed: 1) = (0+1)*2 - 1 = 1
        //   group 1 = page 4 (0-indexed: 3) = (1+1)*2 - 1 = 3
        // Formula: pageIndex = (groupIndex + 1) * pagesPerImage - 1
        
        const basePageIndex = (groupIndex + 1) * pagesPerImage - 1;
        
        // Generate images for this group
        for (let imgInGroup = 0; imgInGroup < imagesPerCount; imgInGroup++) {
          // Calculate actual page index (0-indexed)
          const pageIndex = basePageIndex + imgInGroup;
          
          if (pageIndex < totalPages) {
            imageCounter++;
            
            // Create more descriptive image prompts based on content and frameworks
            const frameworkContext = frameworks.length > 0 
              ? ` related to ${frameworks.map(id => {
                  const fw = Object.keys(frameworkQueries).find(f => f === id);
                  return fw ? fw.replace(/-/g, ' ') : id;
                }).join(', ')}`
              : '';
            
            const imagePrompt = `Professional whitepaper illustration: ${prompt}${frameworkContext}. Create a visual diagram, chart, or infographic suitable for page ${pageIndex + 1} of a ${totalPages}-page research whitepaper. Style: clean, professional, data visualization or conceptual diagram.`;
            
            console.log(`[Whitepaper API] Generating image ${imageCounter}/${totalImages} for page ${pageIndex + 1} (0-indexed: ${pageIndex})`);
            console.log(`[Whitepaper API] Image prompt: ${imagePrompt.substring(0, 150)}...`);
            
            try {
              const imageBase64 = await generateImage(imagePrompt);
              if (imageBase64 && imageBase64.length > 100) { // Minimum reasonable base64 length
                images.push({ pageIndex, base64: imageBase64 });
                console.log(`[Whitepaper API] ✅ Image ${imageCounter} generated successfully (${imageBase64.length} chars, will be placed on page ${pageIndex + 1})`);
              } else {
                console.error(`[Whitepaper API] ❌ Image ${imageCounter} generation returned invalid data (length: ${imageBase64?.length || 0}) for page ${pageIndex + 1}`);
                console.error(`[Whitepaper API] Check if GOOGLE_AI_API_KEY is set and gemini-2.5-flash-image model is accessible`);
              }
            } catch (imageError) {
              console.error(`[Whitepaper API] ❌ Failed to generate image ${imageCounter} for page ${pageIndex + 1}:`, imageError);
              console.error(`[Whitepaper API] Error details:`, imageError instanceof Error ? imageError.message : String(imageError));
              // Continue with other images even if one fails
            }
            
            // Add small delay between image generations to avoid rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
      
      console.log(`[Whitepaper API] ✅ Generated ${images.length}/${totalImages} images successfully`);
      if (images.length > 0) {
        console.log(`[Whitepaper API] Images will be placed at pages: ${images.map(img => img.pageIndex + 1).join(', ')}`);
      } else {
        console.error(`[Whitepaper API] ❌ CRITICAL: No images were generated despite parameters!`);
        console.error(`[Whitepaper API] Check GOOGLE_AI_API_KEY and image generation logs above`);
      }
    } else {
      console.warn(`[Whitepaper API] ⚠️ No images to generate: imagesPerCount=${imagesPerCount}, pagesPerImage=${pagesPerImage}`);
      console.warn(`[Whitepaper API] This means imageFrequency="${imageFrequency}" was not parsed correctly`);
    }

    // Generate document in requested format
    let documentBuffer: Buffer;
    let mimeType: string;
    let fileExtension: string;
    let filename: string;

    if (outputFormat === 'pdf') {
      documentBuffer = await generateWhitepaperPDF(whitepaperContent, images, numPages);
      mimeType = 'application/pdf';
      fileExtension = 'pdf';
      filename = `whitepaper-${Date.now()}.pdf`;
    } else if (outputFormat === 'docx') {
      documentBuffer = await generateWhitepaperDOCX(whitepaperContent, images, numPages);
      mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      fileExtension = 'docx';
      filename = `whitepaper-${Date.now()}.docx`;
    } else if (outputFormat === 'ppt') {
      documentBuffer = await generateWhitepaperPPT(whitepaperContent, images, numPages);
      mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
      fileExtension = 'pptx';
      filename = `whitepaper-${Date.now()}.pptx`;
    } else {
      // Fallback to text
      documentBuffer = Buffer.from(whitepaperContent, 'utf-8');
      mimeType = 'text/plain';
      fileExtension = 'txt';
      filename = `whitepaper-${Date.now()}.txt`;
    }

    const base64Document = documentBuffer.toString('base64');

    return NextResponse.json({
      success: true,
      document: base64Document,
      filename,
      mimeType,
      content: outputFormat === 'ppt' ? undefined : whitepaperContent, // Don't include text preview for PPT
      numPages: Math.min(numPages, 50),
      writingStyle,
      frameworks: frameworks,
      imageFrequency,
      imagesGenerated: images.length,
    });

  } catch (error) {
    console.error('Whitepaper generation error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    // Extract more detailed error information
    let errorMessage = 'Unknown error';
    let errorDetails = '';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      errorDetails = error.stack || '';
      
      // Check for common API errors
      if (error.message.includes('API key')) {
        errorMessage = 'OpenAI API key is invalid or missing';
        errorDetails = 'Please check your OPENAI_API_KEY in .env.local';
      } else if (error.message.includes('rate limit')) {
        errorMessage = 'API rate limit exceeded';
        errorDetails = 'Please wait a moment and try again';
      } else if (error.message.includes('model')) {
        errorMessage = 'Invalid or unavailable OpenAI model';
        errorDetails = `Check your OPENAI_MODEL environment variable. Error: ${error.message}`;
      }
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate whitepaper',
        message: errorMessage,
        details: errorDetails || (error instanceof Error ? error.message : 'Unknown error'),
        hint: 'Check server console logs for detailed error information'
      },
      { status: 500 }
    );
  }
}
