import mongoose from "mongoose";
import { Comment } from "../models/comment.models.js";
import { ApiError } from "../utils/apiError.js";
import { ApiResponse } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
    //TODO: get all comments for a video
    const { videoId } = req.params;
    const { page = 1, limit = 10 } = req.query;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required!");
    }

    const filter = { video: videoId };
    const comments = await Comment.find(filter)
        .populate("owner")
        .skip((parseInt(page) - 1) * parseInt(limit))
        .limit(parseInt(limit));
    
    const totalComments = await Comment.countDocuments(filter);

    return res
        .status(200)
        .json(new ApiResponse(
            200,
            {
                commentData: comments,
                pagination: {
                    currentPage: Number(page),
                    limit: Number(limit),
                    totalComments: totalComments,
                    totalPages: Math.ceil(totalComments / parseFloat(limit))
                }
            },
            "Comments fetched successfully!"
        ));
});

const addComment = asyncHandler(async (req, res) => {
    // TODO: add a comment to a video
    const { videoId } = req.params;
    const { content } = req.body;

    if (!videoId) {
        throw new ApiError(400, "Video ID is required!");
    }
    if (!content?.trim()) {
        throw new ApiError(400, "Comment is required!");
    }

    const comment = await Comment.create({
        content: content.trim(),
        video: new mongoose.Types.ObjectId(String(videoId)),
        owner: new mongoose.Types.ObjectId(String(req.user._id))
    });

    const createdComment = await Comment.findById(comment._id).populate("owner");
    if (!createdComment) {
        return new ApiError(500, "Something went wrong while uploading comment!");
    }

    return res.status(201).json(new ApiResponse(201, createdComment, "Comment uploaded successfully!"));
});

const updateComment = asyncHandler(async (req, res) => {
    // TODO: update a comment
    const { commentId } = req.params;
    const { newContent } = req.body;

    if (!commentId) {
        throw new ApiError(400, "Comment ID is required!");
    }
    if (!newContent?.trim()) {
        throw new ApiError(400, "New comment is required!");
    }

    const updatedComment = await Comment.findByIdAndUpdate(
        commentId,
        {
            $set: {
                content: newContent.trim()
            }
        },
        { new: true }
    ).populate("owner");

    return res.status(200).json(new ApiResponse(200, updatedComment, "Comment updated successfully!"));
});

const deleteComment = asyncHandler(async (req, res) => {
    // TODO: delete a comment
    const { commentId } = req.params;

    if (!commentId) {
        throw new ApiError(400, "Comment ID is required!");
    }

    const deletedComment = await Comment.findByIdAndDelete(commentId);

    return res.status(200).json(new ApiResponse(200, deletedComment, "Comment deleted successfully!"));
});

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
};