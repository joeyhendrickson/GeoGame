import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { prompt, type = 'image' } = await request.json();

    if (!prompt) {
      return NextResponse.json(
        { error: 'Prompt is required' },
        { status: 400 }
      );
    }

    const googleApiKey = process.env.GOOGLE_AI_API_KEY;
    const openaiApiKey = process.env.OPENAI_API_KEY;

    // Try Google Gemini 2.5 Flash Image (Nano Banana) first for image generation
    if (googleApiKey && type === 'image') {
      try {
        // Use Gemini 2.5 Flash Image model (Nano Banana) for image generation
        const geminiImageResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-image:generateContent?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: prompt
                }]
              }],
              generationConfig: {
                temperature: 0.4,
              }
            }),
          }
        );

        if (geminiImageResponse.ok) {
          const geminiData = await geminiImageResponse.json();
          
          // Gemini 2.5 Flash Image returns images in the response parts
          const candidates = geminiData.candidates || [];
          for (const candidate of candidates) {
            const parts = candidate.content?.parts || [];
            for (const part of parts) {
              // Check for inline_data (base64 image)
              if (part.inline_data) {
                const base64Image = part.inline_data.data;
                const mimeType = part.inline_data.mime_type || 'image/png';
                
                return NextResponse.json({
                  success: true,
                  model: 'google',
                  type: 'image',
                  url: `data:${mimeType};base64,${base64Image}`,
                });
              }
              // Check for text that might contain image data URL
              if (part.text && part.text.startsWith('data:image/')) {
                return NextResponse.json({
                  success: true,
                  model: 'google',
                  type: 'image',
                  url: part.text,
                });
              }
            }
          }
          
          // If no image found in standard format, check alternative response structure
          if (geminiData.images && geminiData.images.length > 0) {
            const imageUrl = geminiData.images[0];
            return NextResponse.json({
              success: true,
              model: 'google',
              type: 'image',
              url: typeof imageUrl === 'string' 
                ? (imageUrl.startsWith('data:') ? imageUrl : `data:image/png;base64,${imageUrl}`)
                : imageUrl.url || imageUrl,
            });
          }
        } else {
          const errorText = await geminiImageResponse.text();
          console.error(`Google Gemini 2.5 Flash Image API returned ${geminiImageResponse.status}:`, errorText);
        }
      } catch (googleError) {
        console.error('Google Gemini 2.5 Flash Image API failed:', googleError);
        // Will fall through to OpenAI fallback
      }
    }

    if (googleApiKey && type === 'video') {
      try {
        // Try using Gemini for video generation prompts
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent?key=${googleApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [{
                parts: [{
                  text: `Create a video script or description for: "${prompt}". Return detailed video scene descriptions.`
                }]
              }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 500,
              }
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const videoDescription = data.candidates?.[0]?.content?.parts?.[0]?.text;
          
          return NextResponse.json({
            success: true,
            model: 'google',
            type: 'video',
            content: videoDescription,
            note: 'Google Gemini generated video description/script. Full video generation may require additional services.',
          });
        }
      } catch (googleError) {
        console.warn('Google Gemini video API failed:', googleError);
      }
    }

    // Fallback to OpenAI DALL-E for images
    if (openaiApiKey && type === 'image') {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: openaiApiKey });

      const response = await openai.images.generate({
        model: 'dall-e-3',
        prompt: prompt,
        n: 1,
        size: '1024x1024',
        quality: 'standard',
      });

      const imageUrl = response.data[0]?.url;
      
      if (imageUrl) {
        return NextResponse.json({
          success: true,
          model: 'openai',
          type: 'image',
          url: imageUrl,
        });
      }
    }

    // If we get here and it's a video, OpenAI doesn't support video generation
    if (type === 'video') {
      return NextResponse.json({
        success: false,
        error: 'Video generation is currently only available via Google Gemini. Please ensure GOOGLE_AI_API_KEY is set.',
      }, { status: 400 });
    }

    return NextResponse.json(
      { error: 'No API keys available. Please set GOOGLE_AI_API_KEY or OPENAI_API_KEY.' },
      { status: 500 }
    );

  } catch (error) {
    console.error('Media generation error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate media', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}
