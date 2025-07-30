# Wordle Achievement Event

A Discord bot feature for the RetroAchievements community that runs daily "Wordle" style achievement challenges. Users must earn 5 achievements where the first letter of each achievement title matches the letters of the daily word.

## How It Works

### For Users
1. **Connect Account**: Link your Discord to your RetroAchievements profile using `/wordle-connect`
2. **Check Daily Word**: Use `/wordle-status` to see today's word and required letters
3. **Earn Achievements**: Play games and earn achievements that start with the required letters
4. **Submit**: Use `/wordle-submit` to submit your 5 achievement URLs/IDs
5. **Validation**: Bot automatically validates that:
   - You earned all achievements on the correct date
   - First letters match the daily word
6. **Progress**: Track your progress toward the 30-submission goal for prize eligibility

### Example
If today's word is **ASSET**, you need achievements starting with:
- **A**: "A Distorted Village"
- **S**: "San Francisco" 
- **S**: "Santa Would be so Proud"
- **E**: "Excellent Work"
- **T**: "Top Score"

## Commands

### User Commands
- `/wordle-connect <username>` - Connect your RetroAchievements account
- `/wordle-status` - Check today's word and your progress
- `/wordle-submit <5 achievements>` - Submit your daily achievements
- `/wordle-reset` - Reset today's submission if you made an error

### Admin Commands
- `/wordle-admin set-word <word>` - Set today's 5-letter word
- `/wordle-admin get-word` - View current word and event status

## Setup Instructions

### 1. Database Migration
Run the migration to add the required tables:
```bash
bun run db:migrate-wordle
```

This creates:
- `wordle_user_connections` - Links Discord users to RA accounts
- `wordle_daily_words` - Stores daily words and their letters
- `wordle_user_submissions` - Tracks user submissions and validation
- `wordle_user_progress` - Tracks overall progress toward prizes

### 2. Deploy Commands
Deploy the new slash commands:
```bash
bun run deploy-commands
```

### 3. Set Daily Word
Admins must set the daily word to activate the event:
```
/wordle-admin set-word ASSET
```

## Features

### ✅ Account Verification
- Users must connect verified RetroAchievements accounts
- Bot validates username exists before allowing connection
- Connection persists across sessions

### ✅ Achievement Validation
- Verifies achievements were earned on the correct date
- Validates first letters match the required pattern
- Uses official RetroAchievements API for data integrity

### ✅ Daily Restrictions
- One submission per user per day
- Users can reset and resubmit if needed
- Progress tracked across multiple days

### ✅ Prize Eligibility
- Users become eligible after 30 successful submissions
- Bot automatically tracks and notifies when eligible
- Prevents duplicate prize notifications

### ✅ Admin Controls
- Set daily words easily
- View current event status
- All admin commands require proper permissions

## Technical Details

### Services
- **WordleService**: Manages daily words, letter validation, URL parsing
- **RAUserService**: Handles user connections, achievement validation via RA API

### Database Schema
- Foreign key relationships ensure data integrity
- JSON fields store achievement arrays and letter patterns
- Timestamp tracking for all submissions and validations

### API Integration
- Uses `@retroachievements/api` package for official API access
- Validates user existence and achievement earn dates
- Handles API rate limiting and error responses

### Security
- Admin commands check user permissions
- All user inputs validated and sanitized
- Database queries use parameterized statements
- Ephemeral responses protect user privacy

## Minimal Changes Promise

This feature was designed to minimize changes to the existing codebase:
- ✅ No modifications to existing files (except schema.ts and package.json)
- ✅ All new functionality in separate service files
- ✅ Independent database tables with no foreign keys to existing data
- ✅ Self-contained command files following existing patterns
- ✅ Uses existing utilities (AdminChecker, logger, etc.)

The feature can be easily removed by:
1. Deleting the new command files
2. Removing the service files  
3. Dropping the wordle_* database tables
4. Removing the npm script

## Future Enhancements

Potential additions that could be made:
- Leaderboards showing top participants
- Weekly/monthly special events
- Integration with specific game challenges
- Automated word rotation
- Achievement difficulty scoring
- Team-based competitions

## Troubleshooting

### Event Not Active
- Admin must set daily word using `/wordle-admin set-word`
- Check word was set correctly with `/wordle-admin get-word`

### User Connection Issues
- Verify exact RetroAchievements username (case-sensitive)
- Ensure RA_WEB_API_KEY is configured in environment
- Check user exists on RetroAchievements.org

### Achievement Validation Failures
- Achievements must be earned on the exact date of submission
- First letters must match exactly (case-insensitive)
- Achievement IDs/URLs must be valid RetroAchievements links

### Database Issues
- Ensure migration ran successfully
- Check database file permissions
- Verify schema matches expected structure