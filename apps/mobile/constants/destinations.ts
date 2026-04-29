// Mapa hardcodeado de imágenes y continentes para los 30 destinos más populares.
// Mismo conjunto que usa la Edge Function get-explore-feed (duplicado intencional —
// el Edge Function vive en Deno y no puede importar desde el cliente).
import type { Continent } from '@travelapp/types'

export const DESTINATION_META: Record<string, { image_url: string; continent: Continent }> = {
  'Roma':             { image_url: 'https://images.unsplash.com/photo-1552832230-c0197dd311b5?w=400&q=80&auto=format',  continent: 'Europe'      },
  'París':            { image_url: 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Tokyo':            { image_url: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=400&q=80&auto=format',  continent: 'Asia'        },
  'Barcelona':        { image_url: 'https://images.unsplash.com/photo-1539037116277-4db20889f2d4?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Nueva York':       { image_url: 'https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?w=400&q=80&auto=format',  continent: 'Americas'    },
  'Londres':          { image_url: 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Lisboa':           { image_url: 'https://images.unsplash.com/photo-1588598198321-9735fd9a3e90?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Ámsterdam':        { image_url: 'https://images.unsplash.com/photo-1534351590666-13e3e96b5017?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Berlín':           { image_url: 'https://images.unsplash.com/photo-1560969184-10fe8719e047?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Dubái':            { image_url: 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=400&q=80&auto=format',  continent: 'Middle East' },
  'Bangkok':          { image_url: 'https://images.unsplash.com/photo-1508009603885-50cf7c579365?w=400&q=80&auto=format',  continent: 'Asia'        },
  'Bali':             { image_url: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=400&q=80&auto=format',  continent: 'Asia'        },
  'Cusco':            { image_url: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&q=80&auto=format',  continent: 'Americas'    },
  'Buenos Aires':     { image_url: 'https://images.unsplash.com/photo-1589909202802-8f4aadce1849?w=400&q=80&auto=format',  continent: 'Americas'    },
  'Ciudad de México': { image_url: 'https://images.unsplash.com/photo-1518105779142-d975f22f1b0a?w=400&q=80&auto=format',  continent: 'Americas'    },
  'Estambul':         { image_url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Praga':            { image_url: 'https://images.unsplash.com/photo-1541849546-216549ae216d?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Viena':            { image_url: 'https://images.unsplash.com/photo-1516550893923-42d28e5677af?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Seúl':             { image_url: 'https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=400&q=80&auto=format',  continent: 'Asia'        },
  'Singapur':         { image_url: 'https://images.unsplash.com/photo-1525625293386-3f8f99389edd?w=400&q=80&auto=format',  continent: 'Asia'        },
  'Marrakech':        { image_url: 'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?w=400&q=80&auto=format',  continent: 'Africa'      },
  'Santorini':        { image_url: 'https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Florencia':        { image_url: 'https://images.unsplash.com/photo-1543429258-ee5f9d48b3ae?w=400&q=80&auto=format',  continent: 'Europe'      },
  'Vancouver':        { image_url: 'https://images.unsplash.com/photo-1559521783-1d1599583485?w=400&q=80&auto=format',  continent: 'Americas'    },
  'Sydney':           { image_url: 'https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9?w=400&q=80&auto=format',  continent: 'Oceania'     },
  'Río de Janeiro':   { image_url: 'https://images.unsplash.com/photo-1483729558449-99ef09a8c325?w=400&q=80&auto=format',  continent: 'Americas'    },
  'Nairobi':          { image_url: 'https://images.unsplash.com/photo-1611348524140-53c9a25263d6?w=400&q=80&auto=format',  continent: 'Africa'      },
  'Mumbai':           { image_url: 'https://images.unsplash.com/photo-1529253355930-ddbe423a2ac7?w=400&q=80&auto=format',  continent: 'Asia'        },
  'Cairo':            { image_url: 'https://images.unsplash.com/photo-1568322445389-f64ac2515020?w=400&q=80&auto=format',  continent: 'Africa'      },
  'Lima':             { image_url: 'https://images.unsplash.com/photo-1526392060635-9d6019884377?w=400&q=80&auto=format',  continent: 'Americas'    },
}

export const GENERIC_TRAVEL_IMAGE =
  'https://images.unsplash.com/photo-1488646953014-85cb44e25828?w=400&q=80&auto=format'
