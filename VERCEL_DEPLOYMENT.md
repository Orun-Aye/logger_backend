# Vercel Deployment Guide

This guide will help you deploy your Express.js logger backend to Vercel.

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **Vercel CLI**: Install globally with `npm i -g vercel`
3. **Environment Variables**: Set up your environment variables in Vercel

## Environment Variables

Set these in your Vercel dashboard under Project Settings > Environment Variables:

```
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret_key
NODE_ENV=production
```

## Deployment Steps

### Option 1: Deploy via Vercel CLI

1. **Login to Vercel**:
   ```bash
   vercel login
   ```

2. **Deploy**:
   ```bash
   vercel
   ```

3. **Follow the prompts**:
   - Link to existing project or create new one
   - Set up environment variables
   - Deploy

### Option 2: Deploy via GitHub Integration

1. **Push to GitHub** (if not already done)
2. **Connect to Vercel**:
   - Go to [vercel.com/dashboard](https://vercel.com/dashboard)
   - Click "New Project"
   - Import your GitHub repository
   - Configure environment variables
   - Deploy

## Important Notes

### WebSocket Limitations
- **WebSockets are disabled** in Vercel's serverless environment
- The app automatically detects Vercel environment and disables WebSocket services
- For real-time features, consider using:
  - Vercel's Edge Functions
  - External WebSocket services (Pusher, Socket.io with Redis)
  - Server-Sent Events (SSE)

### File Structure
```
├── api/
│   └── index.js          # Vercel entry point
├── dist/                 # Compiled TypeScript
├── src/                  # Source code
├── vercel.json          # Vercel configuration
├── .vercelignore        # Files to exclude from deployment
└── package.json
```

### API Routes
All your API routes are prefixed with `/api/v1/`:
- `/api/v1/users` - User management
- `/api/v1/projects` - Project management
- `/api/v1/logs` - Log management
- `/api/v1/alerts` - Alert rules
- `/api/v1/dashboard` - Dashboard data

## Testing Deployment

1. **Check deployment status**:
   ```bash
   vercel ls
   ```

2. **Test API endpoints**:
   ```bash
   curl https://your-app.vercel.app/api/v1/health
   ```

3. **View logs**:
   ```bash
   vercel logs
   ```

## Troubleshooting

### Common Issues

1. **Build Failures**:
   - Ensure TypeScript compiles successfully
   - Check that all dependencies are in `dependencies`, not `devDependencies`

2. **Environment Variables**:
   - Verify all required env vars are set in Vercel dashboard
   - Restart deployment after adding new variables

3. **CORS Issues**:
   - Update CORS origin in `src/server.ts` if frontend URL changes
   - Check Vercel headers configuration

4. **Database Connection**:
   - Ensure MongoDB URI is correct
   - Check if IP whitelist includes Vercel's IP ranges

### Debugging

1. **Local Vercel testing**:
   ```bash
   vercel dev
   ```

2. **Check function logs**:
   ```bash
   vercel logs --follow
   ```

## Production Considerations

1. **Performance**:
   - Vercel automatically scales your functions
   - Consider caching strategies for frequently accessed data

2. **Security**:
   - Use environment variables for sensitive data
   - Implement proper authentication and authorization
   - Set up rate limiting

3. **Monitoring**:
   - Use Vercel Analytics for performance monitoring
   - Set up error tracking (Sentry, etc.)

## Next Steps

1. **Set up custom domain** (optional)
2. **Configure CI/CD** with GitHub
3. **Set up monitoring and alerting**
4. **Implement caching strategies**
5. **Consider WebSocket alternatives** for real-time features

Your Express server is now ready for Vercel deployment! 🚀
