const adminOnly = (req, res, next) => {
  if (!req.user) {
    res.status(401);
    throw new Error("Not authorized");
  }

  if (req.user.role !== "admin") {
    res.status(403);
    throw new Error("Admin access only");
  }

  next();
};

export default adminOnly;