export async function resolve(spec, ctx, next) {
  try {
    return await next(spec, ctx)
  } catch (e) {
    if (spec.startsWith('.')) {
      for (const s of ['.js', '/index.js']) {
        try {
          return await next(spec + s, ctx)
        } catch {}
      }
    }
    throw e
  }
}
