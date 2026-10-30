type PageMetadata = {
  title: string
  description: string
  url?: string
  image?: string
  noIndex?: boolean
  structuredData?: Record<string, unknown>
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`)
  if (!element) {
    element = document.createElement('meta')
    element.setAttribute(attribute, key)
    document.head.append(element)
  }
  element.content = content
}

export function setPageMetadata({ title, description, url, image = '/logo.png', noIndex = false, structuredData }: PageMetadata) {
  const pageUrl = url || window.location.href
  const imageUrl = new URL(image, window.location.origin).href
  document.title = title
  setMeta('name', 'description', description)
  setMeta('name', 'robots', noIndex ? 'noindex, nofollow' : 'index, follow')
  setMeta('property', 'og:type', 'website')
  setMeta('property', 'og:locale', 'ar_EG')
  setMeta('property', 'og:site_name', 'متجر الحلم')
  setMeta('property', 'og:title', title)
  setMeta('property', 'og:description', description)
  setMeta('property', 'og:url', pageUrl)
  setMeta('property', 'og:image', imageUrl)
  setMeta('name', 'twitter:card', 'summary_large_image')
  setMeta('name', 'twitter:title', title)
  setMeta('name', 'twitter:description', description)
  setMeta('name', 'twitter:image', imageUrl)

  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
  if (!canonical) {
    canonical = document.createElement('link')
    canonical.rel = 'canonical'
    document.head.append(canonical)
  }
  canonical.href = pageUrl

  let schema = document.head.querySelector<HTMLScriptElement>('#page-structured-data')
  if (structuredData) {
    if (!schema) {
      schema = document.createElement('script')
      schema.id = 'page-structured-data'
      schema.type = 'application/ld+json'
      document.head.append(schema)
    }
    schema.textContent = JSON.stringify(structuredData)
  } else {
    schema?.remove()
  }
}
