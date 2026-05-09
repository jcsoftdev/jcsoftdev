export type { DbClient } from './client.js';
export { createClient } from './client.js';
// Type exports
export type {
  Account,
  Experience,
  Media,
  NewAccount,
  NewExperience,
  NewMedia,
  NewPost,
  NewPostTag,
  NewProject,
  NewTag,
  NewUser,
  Post,
  PostStatus,
  PostTag,
  Project,
  Schema,
  Tag,
  User,
} from './schema/index.js';
// Table exports
export {
  accounts,
  citext,
  experiences,
  media,
  postStatus,
  posts,
  postTags,
  projects,
  schema,
  tags,
  users,
} from './schema/index.js';
