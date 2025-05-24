# Contributing to MemeCoinGen

First off, thank you for considering contributing to MemeCoinGen! It's people like you that make MemeCoinGen such a great tool.

## Code of Conduct

By participating in this project, you are expected to uphold our Code of Conduct:
- Be respectful and inclusive
- Welcome newcomers and help them get started
- Focus on what is best for the community
- Show empathy towards other community members

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When you create a bug report, include as many details as possible:

- **Use a clear and descriptive title**
- **Describe the exact steps to reproduce the problem**
- **Provide specific examples**
- **Describe the behavior you observed and expected**
- **Include screenshots if relevant**
- **Include your environment details**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion:

- **Use a clear and descriptive title**
- **Provide a detailed description of the suggested enhancement**
- **Provide specific examples to demonstrate the enhancement**
- **Describe the current behavior and expected behavior**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. Ensure the test suite passes
4. Make sure your code follows the existing code style
5. Write a clear commit message

## Development Setup

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/your-username/memecoingen.git
   cd memecoingen
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make your changes**
   - Write clean, documented code
   - Add tests for new functionality
   - Update documentation as needed

5. **Run tests**
   ```bash
   npm test
   npm run lint
   ```

6. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```

   We follow [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` new feature
   - `fix:` bug fix
   - `docs:` documentation changes
   - `style:` formatting changes
   - `refactor:` code refactoring
   - `test:` test additions/changes
   - `chore:` maintenance tasks

7. **Push to your fork**
   ```bash
   git push origin feature/your-feature-name
   ```

8. **Open a Pull Request**

## Style Guidelines

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow the existing ESLint configuration
- Use meaningful variable and function names
- Add JSDoc comments for public APIs

### React Components
- Use functional components with hooks
- Keep components small and focused
- Use proper TypeScript types for props
- Follow the existing component structure

### Convex Functions
- Keep functions pure when possible
- Handle errors appropriately
- Add proper TypeScript types
- Document complex logic

### Git Commit Messages
- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

## Testing

- Write unit tests for utility functions
- Write integration tests for API endpoints
- Test error cases, not just happy paths
- Aim for high test coverage but focus on critical paths

## Documentation

- Update the README.md if you change functionality
- Update inline documentation for code changes
- Add JSDoc comments for new functions
- Update the API documentation if you change endpoints

## Questions?

Feel free to open an issue with your question or reach out on our Discord server.

Thank you for contributing! 🚀