

export class SearchEngine {


  // Google-style search with operators and relevance scoring
  search(query) {
    if (!query.trim()) return this.resources

    const operators = this.parseSearchOperators(query)
    let filteredResources = [...this.resources]

    // Apply search operators
    if (operators.type) {
      filteredResources = filteredResources.filter(
        (r) =>
          r.category.toLowerCase().includes(operators.type.toLowerCase()) ||
          r.fileType.toLowerCase().includes(operators.type.toLowerCase()),
      )
    }

    if (operators.author) {
      filteredResources = filteredResources.filter((r) =>
        r.author.toLowerCase().includes(operators.author.toLowerCase()),
      )
    }

    if (operators.price) {
      const [operator, value] = operators.price
      filteredResources = filteredResources.filter((r) => {
        switch (operator) {
          case "<":
            return r.price < value
          case ">":
            return r.price > value
          case "=":
            return r.price === value
          default:
            return true
        }
      })
    }

    if (operators.rating) {
      filteredResources = filteredResources.filter((r) => r.rating >= operators.rating)
    }

    // Apply text search with relevance scoring
    const searchTerms = operators.text
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0)

    if (searchTerms.length > 0) {
      filteredResources = filteredResources
        .map((resource) => ({
          ...resource,
          relevanceScore: this.calculateRelevance(resource, searchTerms),
        }))
        .filter((resource) => resource.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
    }

    return filteredResources
  }

  parseSearchOperators(query) {
    const operators = {
      text: query,
      type: null,
      author: null,
      price: null,
      rating: null,
    }

    // Parse type: operator
    const typeMatch = query.match(/type:(\w+)/i)
    if (typeMatch) {
      operators.type = typeMatch[1]
      operators.text = operators.text.replace(/type:\w+/i, "").trim()
    }

    // Parse author: operator
    const authorMatch = query.match(/author:(\w+)/i)
    if (authorMatch) {
      operators.author = authorMatch[1]
      operators.text = operators.text.replace(/author:\w+/i, "").trim()
    }

    // Parse price operators
    const priceMatch = query.match(/price:([<>=])(\d+)/i)
    if (priceMatch) {
      operators.price = [priceMatch[1], Number.parseInt(priceMatch[2])]
      operators.text = operators.text.replace(/price:[<>=]\d+/i, "").trim()
    }

    // Parse rating: operator
    const ratingMatch = query.match(/rating:(\d+(?:\.\d+)?)/i)
    if (ratingMatch) {
      operators.rating = Number.parseFloat(ratingMatch[1])
      operators.text = operators.text.replace(/rating:\d+(?:\.\d+)?/i, "").trim()
    }

    return operators
  }

  calculateRelevance(resource, searchTerms) {
    let score = 0

    searchTerms.forEach((term) => {
      // Title matches (highest weight)
      if (resource.title.toLowerCase().includes(term)) {
        score += 10
        if (resource.title.toLowerCase().startsWith(term)) score += 5
      }

      // Tag matches (high weight)
      if (resource.tags.some((tag) => tag.toLowerCase().includes(term))) {
        score += 8
      }

      // Category matches (medium weight)
      if (resource.category.toLowerCase().includes(term)) {
        score += 6
      }

      // Author matches (medium weight)
      if (resource.author.toLowerCase().includes(term)) {
        score += 5
      }

      // Description matches (lower weight)
      if (resource.description.toLowerCase().includes(term)) {
        score += 3
      }
    })

    // Boost featured items
    if (resource.featured) score *= 1.2

    // Boost highly rated items
    score *= resource.rating / 5

    // Boost popular items
    score *= Math.log10(resource.downloads + 1) / 4

    return score
  }

  getSuggestions(query) {
    if (query.length < 2) return []

    const suggestions = new Set()
    const lowerQuery = query.toLowerCase()

    this.resources.forEach((resource) => {
      // Title suggestions
      if (resource.title.toLowerCase().includes(lowerQuery)) {
        suggestions.add(resource.title)
      }

      // Tag suggestions
      resource.tags.forEach((tag) => {
        if (tag.toLowerCase().includes(lowerQuery)) {
          suggestions.add(tag)
        }
      })

      // Category suggestions
      if (resource.category.toLowerCase().includes(lowerQuery)) {
        suggestions.add(resource.category)
      }

      // Author suggestions
      if (resource.author.toLowerCase().includes(lowerQuery)) {
        suggestions.add(`author:${resource.author}`)
      }
    })

    return Array.from(suggestions).slice(0, 8)
  }
}
