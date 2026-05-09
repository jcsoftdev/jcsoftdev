// Schema barrel — all tables exported here and composed into the schema object
// used by the Drizzle client.

export type { Account, NewAccount } from './accounts.js';
export { accounts } from './accounts.js';
export type { Experience, NewExperience } from './experiences.js';
export { experiences } from './experiences.js';
export type { Media, NewMedia } from './media.js';
export { media } from './media.js';
export type { NewPost, Post, PostStatus } from './posts.js';
export { postStatus, posts } from './posts.js';
export type { NewProject, Project } from './projects.js';
export { projects } from './projects.js';
export type { NewPostTag, NewTag, PostTag, Tag } from './tags.js';
export { postTags, tags } from './tags.js';
export type { NewUser, User } from './users.js';
export { citext, users } from './users.js';

import { accounts } from './accounts.js';
import { experiences } from './experiences.js';
import { media } from './media.js';
import { postStatus, posts } from './posts.js';
import { projects } from './projects.js';
import { postTags, tags } from './tags.js';
import { users } from './users.js';

export const schema = {
  users,
  accounts,
  media,
  postStatus,
  posts,
  tags,
  postTags,
  projects,
  experiences,
} as const;

export type Schema = typeof schema;
