//ContentSchema를 이용해 만든 Content 모델 객체 불러옴.
import Content from '../../models/content';
import mongoose from 'mongoose';
import Joi from 'joi';
import sanitizeHtml from 'sanitize-html';

const { ObjectId } = mongoose.Types;

export const getContentById = async (ctx, next) => {
  const { id } = ctx.params;
  if (!ObjectId.isValid(id)) {
    ctx.status = 400;
    return;
  }
  try {
    const content = await Content.findById(id);
    if (!content) {
      ctx.status = 404;
      return;
    }
    ctx.state.content = content;
    return next();
  } catch (e) {
    ctx.throw(500, e);
  }
};

//자신이 작성한 작품인지 결정. 관리자일 경우에도 true
export const checkOwnContent = (ctx, next) => {
  const { user, content } = ctx.state;
  if (user.role !== 'admin' && content.user._id.toString() !== user._id) {
    ctx.status = 403;
    return;
  }
  return next();
};

//포스트 작성, async로 비동기 처리.
export const write = async (ctx) => {
  //객체의 필드를 검증하기 위함
  const schema = Joi.object()
    .keys({
      title: Joi.string().required(),
      body: Joi.string().required(),
      taggedContest: Joi.string(),
      //videoURL: Joi.string(),
      team: Joi.string().required(),
      status: Joi.string().required(),
      stars: Joi.number(),
      star_edUser: Joi.array(),
    })
    .unknown(); //videoURL, github가 비어있어도 등록 가능하도록.

  //객체 필드 검증 결과가 result에 저장.
  const result = Joi.validate(ctx.request.body, schema);
  if (result.error) {
    ctx.status = 400; //bad request
    ctx.body = result.error;
    return;
  }
  console.log(result.value);

  const {
    title,
    body,
    taggedContest,
    taggedContestID,
    videoURL,
    team,
    status,
    github,
  } = ctx.request.body;
  const content = new Content({
    title,
    body,
    taggedContest,
    taggedContestID,
    videoURL,
    team,
    status,
    github,
    stars: 0,
    star_edUser: [], //star를 누른 유저들의 id를 저장하는 array
    user: ctx.state.user,
  });
  try {
    await content.save();
    ctx.body = content;
  } catch (e) {
    ctx.throw(500, e);
  }
};

//removes html tags, slices paragraph.
const removeHtmlAndShorten = (body) => {
  const filtered = sanitizeHtml(body, {
    allowedTags: [],
    //   'h1',
    //   'h2',
    //   'b',
    //   'i',
    //   'u',
    //   's',
    //   'p',
    //   'ul',
    //   'ol',
    //   'li',
    //   'blockquote',
    //   'a',
    //   'img',
    // ],
    // allowedAttributes: {
    //   a: ['href', 'name', 'target'],
    //   img: ['src'],
    //   li: ['class'],
    // },
    // allowedSchemes: ['data', 'http'],
  });
  return filtered.length < 200 ? filtered : `${filtered.slice(0, 200)}...`;
};

//포스트 목록 조회
export const list = async (ctx) => {
  //current page number
  const page = parseInt(ctx.query.page || '1', 12);

  if (page < 1) {
    ctx.status = 400;
    return;
  }

  //get taggedContest from url
  const contest = ctx.query.taggedContestID;
  const query = contest ? { taggedContestID: contest } : {};

  try {
    //Content는 content 모델
    const contents = await Content.find(query)
      .sort({ _id: -1 })
      .limit(12)
      .skip((page - 1) * 12)
      .lean()
      .exec();
    const contentCount = await Content.countDocuments(query).exec();
    ctx.set('Last-Page', Math.ceil(contentCount / 12));
    ctx.body = contents.map((content) => ({
      ...content,
      body: removeHtmlAndShorten(content.body),
    }));
  } catch (e) {
    ctx.throw(500, e);
  }
};

//전체 contents를 불러옴
export const fullList = async (ctx) => {
  const contest = ctx.query.taggedContestID;
  const query = contest ? { taggedContestID: contest } : {};

  try {
    const contents = await Content.find(query).sort({ _id: -1 }).lean().exec();

    ctx.body = contents.map((content) => ({
      ...content,
      body: removeHtmlAndShorten(content.body),
    }));
  } catch (e) {
    ctx.throw(500, e);
  }
};

//특정 id를 갖는 포스트 조회
export const read = async (ctx) => {
  const { id } = ctx.params;
  try {
    const content = await Content.findById(id).exec();
    //받은 id에 해당하는 content가 존재하지 않으면
    if (!content) {
      ctx.status = 404;
      return;
    }
    ctx.body = content;
  } catch (e) {
    ctx.throw(500, e);
  }
};

//특정 id를 갖는 content 삭제
export const remove = async (ctx) => {
  const { id } = ctx.params;
  try {
    await Content.findByIdAndRemove(id).exec();
    ctx.status = 204; // nothing to return.
  } catch (e) {
    ctx.throw(500, e);
  }
};

export const update = async (ctx) => {
  //객체의 필드를 검증하기 위함
  const schema = Joi.object()
    .keys({
      title: Joi.string(),
      body: Joi.string(),
      taggedContest: Joi.string(),
      team: Joi.string(),
      status: Joi.string(),
      stars: Joi.number(),
      star_edUser: Joi.array(),
      prizedPlace: Joi.string(),
    })
    .unknown();

  //객체 필드 검증 결과가 result에 저장.
  const result = Joi.validate(ctx.request.body, schema);
  if (result.error) {
    console.log(result.error);
    ctx.status = 400; //bad request
    ctx.body = result.error;
    return;
  }

  const { id } = ctx.params;
  try {
    const content = await Content.findByIdAndUpdate(id, ctx.request.body, {
      new: true,
    }).exec();
    if (!content) {
      ctx.status = 404;
      return;
    }
    ctx.body = content;
  } catch (e) {
    ctx.throw(500, e);
  }
};
