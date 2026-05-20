import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { pdfBase64, systemPrompt, model: clientModel, apiKey: clientApiKey } = await request.json();

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: { message: 'Falta la API Key de Gemini. Configúrala en la app o en las variables de entorno.' } },
        { status: 400 }
      );
    }

    if (!pdfBase64) {
      return NextResponse.json({ error: { message: 'Falta el PDF.' } }, { status: 400 });
    }

    const model = clientModel || 'gemini-2.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const userInstruction = `A continuación tienes el PDF del tema de la oposición.

Genera los dos archivos siguiendo exactamente las especificaciones del sistema.

Responde ÚNICAMENTE con el siguiente formato, sin texto adicional antes ni después:

===TXT_START===
[aquí el contenido completo del archivo TXT de guiones de audio]
===TXT_END===
===HTML_START===
[aquí el contenido completo del archivo HTML de presentación]
===HTML_END===`;

    const payload = {
      system_instruction: {
        parts: [{ text: systemPrompt }]
      },
      contents: [
        {
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: 'application/pdf',
                data: pdfBase64
              }
            },
            { text: userInstruction }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 65536
      }
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data.error || { message: `Error de Gemini: ${response.status}` } },
        { status: response.status }
      );
    }

    const rawText: string = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const txtMatch = rawText.match(/===TXT_START===([\s\S]*?)===TXT_END===/);
    const htmlMatch = rawText.match(/===HTML_START===([\s\S]*?)===HTML_END===/);

    if (!txtMatch || !htmlMatch) {
      return NextResponse.json(
        {
          error: { message: 'El modelo no devolvió el formato esperado. Inténtalo de nuevo.' },
          debug: rawText.slice(0, 800)
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      txt: txtMatch[1].trim(),
      html: htmlMatch[1].trim()
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: { message: error.message || 'Error interno del servidor.' } },
      { status: 500 }
    );
  }
}
