const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generate Property Description
const generatePropertyDescription = async (req, res) => {
  try {
    const {
      title,
      propertyType,
      bhk,
      area,
      city,
      locality,
      furnishType,
      amenities
    } = req.body;

    if (!title || !propertyType || !bhk || !area || !city) {
      return res.status(400).json({
        success: false,
        message: 'Required fields: title, propertyType, bhk, area, city'
      });
    }

    const prompt = `Generate an engaging property description for a rental listing with the following details:

Property Title: ${title}
Property Type: ${propertyType}
Configuration: ${bhk}
Area: ${area} sq ft
Location: ${locality ? `${locality}, ` : ''}${city}
Furnishing: ${furnishType || 'Not specified'}
Amenities: ${amenities?.join(', ') || 'Not specified'}

Please write a compelling 150-200 word description that highlights the property's key features, location benefits, and appeal to potential tenants. Make it professional yet engaging, and focus on what makes this property special.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a professional property listing writer who creates engaging and accurate property descriptions for rental platforms."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 300,
      temperature: 0.7,
    });

    const generatedDescription = completion.choices[0].message.content.trim();

    res.json({
      success: true,
      data: {
        description: generatedDescription,
        usage: completion.usage
      }
    });
  } catch (error) {
    console.error('OpenAI API Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate description',
      error: error.message
    });
  }
};

module.exports = {
  generatePropertyDescription
};