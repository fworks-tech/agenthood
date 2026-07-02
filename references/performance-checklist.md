# Performance Checklist

## Core Web Vitals
- LCP <= 2.5s, INP <= 200ms, CLS <= 0.1

## Frontend
- [ ] Images optimized (compression, responsive sizes, lazy loading)
- [ ] Bundle size within budget (<200KB gzipped initial load)
- [ ] No N+1 API requests
- [ ] Code splitting at route level
- [ ] No render-blocking resources above the fold

## Backend
- [ ] Database queries have appropriate indexes
- [ ] No N+1 query patterns
- [ ] List endpoints paginated
- [ ] Caching configured for repeated queries
- [ ] Response compression enabled

## Monitoring
- [ ] Performance budget enforced in CI
- [ ] Core Web Vitals tracked in production
