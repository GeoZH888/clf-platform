// netlify/functions/azure-speech-token.js
// Returns a short-lived Azure Cognitive Services token so the API key
// never touches the client.  Token is valid for 10 minutes.
//
// Required Netlify env vars (Dashboard → Site settings → Env variables):
//   AZURE_SPEECH_KEY    your Azure Speech resource key
//   AZURE_SPEECH_REGION e.g. "eastasia" or "westeurope"

exports.handler = async () => {
  const key    = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;

  const cors = {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (!key || !region) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: 'AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set' }),
    };
  }

  try {
    const res = await fetch(
      `https://${region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      { method: 'POST', headers: { 'Ocp-Apim-Subscription-Key': key } }
    );
    if (!res.ok) throw new Error(`Azure returned ${res.status}`);

    const token = await res.text();
    return {
      statusCode: 200,
      headers: { ...cors, 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, region }),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: cors,
      body: JSON.stringify({ error: err.message }),
    };
  }
};
