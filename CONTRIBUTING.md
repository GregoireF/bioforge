# Contributing to BioForge

Thank you for your interest in contributing to BioForge! This document provides guidelines and instructions for contributing to the project.

## Development Setup

1. **Fork and clone the repository**
```bash
git clone https://github.com/your-username/bioforge.git
cd bioforge
```

2. **Install dependencies**
```bash
pnpm install
```

3. **Start development environment**
```bash
docker compose up --build
```

Or without Docker:
```bash
supabase start
pnpm dev
```

## Code Standards

### TypeScript
- Use strict TypeScript mode
- No `any` types unless absolutely necessary
- Properly type all function parameters and return values
- Use interfaces for object shapes

### Code Style
- Follow the existing code style
- Use Prettier for formatting: `pnpm format`
- Use meaningful variable and function names
- Write comments for complex logic

### Components
- Keep components focused and single-purpose
- Use Astro components for static content
- Avoid unnecessary client-side JavaScript
- Follow the mobile-first responsive design approach

### Database
- Never bypass RLS (Row Level Security)
- Use RPC functions for complex operations
- Always add appropriate indexes
- Document schema changes in migration files

## Git Workflow

### Branch Naming
- `feature/description` - New features
- `fix/description` - Bug fixes
- `refactor/description` - Code refactoring
- `docs/description` - Documentation updates

### Commit Messages
Follow the conventional commits specification:

```
type(scope): subject

body (optional)

footer (optional)
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding tests
- `chore`: Maintenance tasks

Examples:
```
feat(dashboard): add link reordering via drag and drop
fix(auth): resolve token refresh issue on mobile
docs(readme): update deployment instructions
```

### Pull Request Process

1. **Create a feature branch**
```bash
git checkout -b feature/your-feature-name
```

2. **Make your changes**
- Write clean, tested code
- Update documentation if needed
- Add tests if applicable

3. **Commit your changes**
```bash
git add .
git commit -m "feat(scope): description"
```

4. **Push to your fork**
```bash
git push origin feature/your-feature-name
```

5. **Create a Pull Request**
- Provide a clear description of changes
- Reference any related issues
- Request review from maintainers

## Testing

Before submitting a PR:

1. **Test locally**
- Register a new account
- Create a profile
- Add and manage links
- Visit your public page
- Test on mobile and desktop

2. **Verify build**
```bash
pnpm build
pnpm preview
```

3. **Check TypeScript**
```bash
pnpm astro check
```

## Database Migrations

When adding database changes:

1. **Create a new migration file**
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_description.sql
```

2. **Include**
- Table alterations
- New indexes
- RLS policy updates
- Comments for documentation

3. **Test locally**
```bash
supabase db reset
```

## Adding New Features

### Frontend Features
1. Create components in `src/components/`
2. Use TailwindCSS for styling
3. Ensure responsive design
4. Add proper TypeScript types
5. Update relevant pages

### Backend Features
1. Add database tables/columns via migrations
2. Create RLS policies
3. Add API endpoints in `src/pages/api/`
4. Implement proper validation
5. Update TypeScript types in `supabaseClient.ts`

## Performance Guidelines

- Minimize database queries (target 1 query per page load)
- Use appropriate caching headers
- Optimize images before uploading
- Lazy load non-critical content
- Use CDN for static assets

## Security Guidelines

- Never expose sensitive data in client code
- Always validate user input (client AND server)
- Use RLS for all database access
- Implement CSRF protection
- Sanitize user-generated content
- Use HTTP-only cookies for auth

## Documentation

When adding features:
- Update README.md if needed
- Add inline code comments
- Document complex algorithms
- Update API documentation
- Add examples for new features

## Questions?

If you have questions:
- Check existing issues and discussions
- Review the README and documentation
- Ask in pull request comments
- Contact the maintainers

## Code of Conduct

- Be respectful and professional
- Welcome newcomers
- Focus on constructive feedback
- Assume good intentions

Thank you for contributing to BioForge! 🚀
